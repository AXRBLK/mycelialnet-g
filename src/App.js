import React, { useEffect, useState } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import axios from 'axios';
import * as d3 from 'd3-force'; // Import d3-force for collision and other forces

function App() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);  // Add loading state
  const [clickedNode, setClickedNode] = useState(null);  // Track the clicked node
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });  // Track tooltip position
  const [viewMode, setViewMode] = useState('Industry'); // Toggle between 'Industry' and 'Country'

  const colorScheme = ['#ffffff', '#FBF3D5', '#D6DAC8', '#FF33A1', '#33FFF9'];
  const circleRadius = 15; // Fixed radius for static circles

  // Backend modification of level 0 node text for 'Country' or Alternative view
  const level0Text = "🌍"; // Modify this variable in the backend to change level 0 node text

  // Customizable text for the hyperlink in the tooltip
  const linkText = "🌐 Website";  // Modify this variable to change the tooltip hyperlink text

  useEffect(() => {
    const fetchData = async () => {
      const sheetId = '1Ci4Hay8-cHgqq9L8LZV6WIH5rgn8BVJa6018xEmdKTo';
      const apiKey = 'AIzaSyCvCL5fqdrjGj_WjMt_fVDpPLWYSSLRjs8';
      const range = 'Sheet1!A1:H10';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

      try {
        const response = await axios.get(url);
        const rows = response.data.values;

        let nodeData = [];
        let linkData = [];

        if (viewMode === 'Industry') {
          const parentMap = {};
          rows.forEach((row, index) => {
            if (index === 0) return;
            const [node, parent, description, url, , , , tooltip] = row;
            nodeData.push({ id: node, description: description || '', tooltip: tooltip || '', url: url || '' });
            if (parent) {
              parentMap[node] = parent;
              linkData.push({ source: parent, target: node });
            }
          });

          const getDepth = (nodeId) => {
            let depth = 0;
            let current = nodeId;
            while (parentMap[current] && depth < colorScheme.length - 1) {
              current = parentMap[current];
              depth++;
            }
            return depth;
          };

          nodeData.forEach((node) => {
            const depth = getDepth(node.id);
            node.depth = depth;
            node.color = colorScheme[depth];
          });

        } else if (viewMode === 'Country') {
          const countries = new Set();
          const countryNodes = {};
          rows.forEach((row, index) => {
            if (index === 0) return;
            const [node, , description, url, country, , , tooltip] = row;
            if (country) {
              countries.add(country);
              if (!countryNodes[country]) {
                countryNodes[country] = { id: country, depth: 1, color: colorScheme[1] };
                nodeData.push(countryNodes[country]);
                linkData.push({ source: level0Text, target: country });
              }
              nodeData.push({ id: node, description: description || '', tooltip: tooltip || '', url: url || '', color: colorScheme[2], depth: 2 });
              linkData.push({ source: country, target: node });
            }
          });
          nodeData.unshift({ id: level0Text, depth: 0, color: colorScheme[0] });
        }

        setNodes(nodeData);
        setLinks(linkData);
      } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [viewMode, level0Text]);

  const graphData = { nodes: nodes, links: links };

  // Helper function to wrap text for circular nodes
  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    
    words.forEach(word => {
      const testLine = line + word;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && line !== '') {
        lines.push(line);
        line = word + ' ';
      } else {
        line = testLine;
      }
    });
    lines.push(line);
    return lines;
  };

  // Custom node rendering with circular nodes for depth 0 and 1, rectangular for deeper nodes
  const paintNode = (node, ctx, globalScale) => {
    let fontSize = Math.max(2.5, 3 / globalScale);

    if (node.depth === 0) {
      fontSize *= 10;
      ctx.font = `bold ${fontSize}px "Courier New"`;
    } else if (node.depth === 1) {
      fontSize *= 1.2;
      ctx.font = `${fontSize}px "Courier New"`;
    } else {
      ctx.font = `${fontSize}px "Courier New"`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (node.depth <= 1) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, circleRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || 'orange';
      ctx.fill();

      if (clickedNode && clickedNode.id === node.id) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'yellow';
        ctx.stroke();
      }

      ctx.fillStyle = 'black';
      const maxWidth = 10; // Set maximum width for text wrapping
      const textLines = wrapText(ctx, node.id.toUpperCase(), maxWidth); // Convert text to small caps
      const textHeight = textLines.length * fontSize + 1;
      
      textLines.forEach((line, index) => {
        const lineX = node.x;
        const lineY = node.y - textHeight / 2 + (index + 0.5) * fontSize;
        ctx.fillText(line, lineX, lineY);
      });

    } else {
      const textWidth = ctx.measureText(node.id).width;
      const bckgDimensions = [textWidth + 12, fontSize + 8];
      ctx.fillStyle = node.color || 'orange';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

      if (clickedNode && clickedNode.id === node.id) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'yellow';
        ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
      }

      ctx.fillStyle = 'black';
      ctx.fillText(node.id, node.x, node.y);
    }
  };

  const handleNodeClick = (node, event) => {
    if (!node.tooltip || node.tooltip.trim() === '') {
      setClickedNode(null);
      return;
    }

    setClickedNode(node);
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    setTooltipPos({ x: mouseX + 20, y: mouseY - 20 });
    event.stopPropagation();
  };

  return (
    <div align="center" onClick={() => setClickedNode(null)} style={{ fontFamily: 'Courier New' }}>
      <h1>MycelialNet🌏</h1>
      <label>
        <input type="radio" name="viewMode" value="Industry" checked={viewMode === 'Industry'} onChange={() => setViewMode('Industry')} />
        Industry
      </label>
      <label style={{ marginLeft: '10px' }}>
        <input type="radio" name="viewMode" value="Country" checked={viewMode === 'Country'} onChange={() => setViewMode('Country')} />
        Country
      </label>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <>
          <ForceGraph2D
            graphData={graphData}
            nodeCanvasObject={paintNode}
            linkCurvature={0.2}
            nodeAutoColorBy="depth"
            d3Force={forceSimulation => {
              forceSimulation.force('collision', d3.forceCollide(circleRadius * 1.2 + 12));
              forceSimulation.force('y', d3.forceY(0).strength(0.1));
            }}
            onNodeClick={handleNodeClick}
          />
          {clickedNode && (
            <div style={{
              position: 'absolute',
              top: `${tooltipPos.y}px`,
              left: `${tooltipPos.x}px`,
              padding: '10px',
              color: 'white',
              backgroundColor: '#505050',
              pointerEvents: 'auto',
              zIndex: 1000,
              width: '20vw',
              fontSize: '80%',
              whiteSpace: 'normal'
            }}>
              {clickedNode.tooltip}
              {clickedNode.url && (
                <a
                  href={clickedNode.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'lightblue', marginLeft: '10px', pointerEvents: 'auto' }}
                >
                  {linkText} {/* Use customizable link text */}
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;