import React, { useEffect, useState } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import axios from 'axios';
import * as d3 from 'd3-force'; // Import d3-force for collision and other forces

function App() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clickedNode, setClickedNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState('Industry');

  const colorScheme = ['#ffffff', '#66CFFF', '#cfff66', '#ffffff', '#33FFF9'];
  const circleRadius = 20; // Fixed radius for static circles

  const level0Text = "🌍"; // Modify this variable in the backend to change level 0 node text
  const linkText = "🌐 Website";

  useEffect(() => {
    const fetchData = async () => {
      const sheetId = '1Ci4Hay8-cHgqq9L8LZV6WIH5rgn8BVJa6018xEmdKTo';
      const apiKey = 'AIzaSyCvCL5fqdrjGj_WjMt_fVDpPLWYSSLRjs8';
      const range = 'Main!A1:L500';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

      try {
        const response = await axios.get(url);
        const rows = response.data.values;

        let nodeData = [];
        let linkData = [];

        if (viewMode === 'Industry') {
          const parentMap = {};
          rows.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            const [node, parent, description, url, , , , tooltip, , , , displayName] = row; // Use column L as displayName

            const nodeName = displayName || node;

            nodeData.push({ id: nodeName, description: description || '', tooltip: tooltip || '', url: url || '' });
            if (parent) {
              parentMap[nodeName] = parent;
              linkData.push({ source: parent, target: nodeName });
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
          const countryNodes = {};
          const categoryNodes = {};

          rows.forEach((row, index) => {
            if (index === 0) return;
            const [node, category, description, url, country, , , tooltip] = row;

            const countryCategoryKey = `${country}-${category}`;

            if (country) {
              if (!countryNodes[country]) {
                countryNodes[country] = { id: country, depth: 1, color: colorScheme[1] };
                nodeData.push(countryNodes[country]);
                linkData.push({ source: level0Text, target: country });
              }

              if (!categoryNodes[countryCategoryKey]) {
                categoryNodes[countryCategoryKey] = { 
                  id: countryCategoryKey, 
                  name: category, 
                  depth: 2, 
                  color: colorScheme[2] 
                };
                nodeData.push(categoryNodes[countryCategoryKey]);
                linkData.push({ source: country, target: countryCategoryKey });
              }

              nodeData.push({
                id: node,
                description: description || '',
                tooltip: tooltip || '', // Tooltip data from column H
                url: url || '',
                color: colorScheme[3],
                depth: 3
              });
              linkData.push({ source: countryCategoryKey, target: node });
            }
          });

          nodeData.unshift({ id: level0Text, depth: 0, color: colorScheme[0] });
        }

        // Apply concentric layout (onion-like) to enforce hierarchy
        applyConcentricLayout(nodeData, 300);

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

  // Concentric layout to visually emphasize hierarchy and prevent crossing
  const applyConcentricLayout = (nodeData, radiusStep) => {
    const layers = {};

    nodeData.forEach(node => {
      if (!layers[node.depth]) {
        layers[node.depth] = [];
      }
      layers[node.depth].push(node);
    });

    // Place nodes in concentric circles based on their depth
    Object.keys(layers).forEach(depth => {
      const layer = layers[depth];
      const angleStep = (40 * Math.PI) / layer.length + 10;
      layer.forEach((node, i) => {
        const angle = i * angleStep;
        const radius = radiusStep * depth;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      });
    });
  };

  const graphData = { nodes: nodes, links: links };

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

  const paintNode = (node, ctx, globalScale) => {
    let fontSize = Math.max(2.5, 3 / globalScale);

    if (node.depth === 0) {
      fontSize *= 10;
      ctx.font = `bold ${fontSize}px "Courier New"`;
    } else if (node.depth === 1) {
      fontSize *= 1.4;
      ctx.font = `bold ${fontSize}px "Courier New" `;
    } else if (node.depth === 2) {
      fontSize *= 1.5;
      ctx.font = `bold ${fontSize}px "Courier New" `;
    } else {
      ctx.font = `bold ${fontSize}px "Courier New"`;
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
        ctx.strokeStyle = 'black';
        ctx.stroke();
      }

      ctx.fillStyle = 'black';
      const maxWidth = 10;
      const textLines = wrapText(ctx, node.id.toUpperCase(), maxWidth);
      const textHeight = textLines.length * fontSize + 1;

      textLines.forEach((line, index) => {
        const lineX = node.x;
        const lineY = node.y - textHeight / 2 + (index + 0.5) * fontSize;
        ctx.fillText(line, lineX, lineY);
      });

    } else {
      const text = node.name || node.id;
      const textWidth = ctx.measureText(text).width;
      const bckgDimensions = [textWidth, fontSize];
      ctx.fillStyle = node.color || 'orange';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

      if (clickedNode && clickedNode.id === node.id) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#83ff66';
        ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
      }

      ctx.fillStyle = 'black';
      ctx.fillText(text, node.x, node.y);
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
    setTooltipPos({ x: mouseX - 3, y: mouseY -1 });
    event.stopPropagation();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => setClickedNode(null)}>
        <h1>MycelialNet🌍</h1>
          
        <div style={{alignItems:'center', textAlign:'center', marginBottom:'20px'}}>
          <label>
            <input type="radio" name="viewMode" value="Industry" checked={viewMode === 'Industry'} onChange={() => setViewMode('Industry')} />
            Industry
          </label>
          <label style={{ marginLeft: '10px' }}>
            <input type="radio" name="viewMode" value="Country" checked={viewMode === 'Country'} onChange={() => setViewMode('Country')} />
            Country
          </label>
        </div>
        <i style={{ fontSize: '12px', margin: '0 5px 0 0', backgroundColor: 'green', padding: '5px', borderRadius: '5px', fontWeight: 'bold' }}>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLScKplrwxm-Xt7gZF2irypVUa0StEApnWMvnvhgZFOEWAICbKA/viewform" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>
            + Add a Company Here!
          </a>
        </i>
         <p style={{ fontSize: '10px', margin: '5px 5px 20px 0', backgroundColor: 'navy', padding: '5px', borderRadius: '5px', fontWeight: 'bold' }}>
          <a href="mailto:alex.r.blunk@gmail.com?subject=MycelialNet%20Inquiry" style={{ color: 'white', textDecoration: 'none' }}>
            ✉️ Contact
          </a>
        </p>

        <div style={{ display: 'flex', alignItems: 'center'}}>
            <p style={{ fontSize: '8px', margin: '0 5px 0 0' }}>Created by</p>
              <a href="https://www.linkedin.com/in/alblunk/" target="_blank" rel="noopener noreferrer">
                <img src={`${process.env.PUBLIC_URL}/blunkworks.png`} alt="Blunkworks" style={{ width: '65px' }} /></a> 
         </div>  
         <p style={{ fontSize: '8px', margin: '0 0 20px 0' }}>⚠️ In Construction! // If things look weird, pull the nodes into open space and it should clean itself up. :)</p>
        
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <>
            <ForceGraph2D
              graphData={graphData}
              nodeCanvasObject={paintNode}
              linkCurvature={0.0}
              nodeAutoColorBy="depth"
              d3Force={forceSimulation => {
                forceSimulation.force('link', d3.forceLink().id(d => d.id).distance(150));

                // Collision force to prevent node overlap
                forceSimulation.force('collision', d3.forceCollide(d => (d.depth === 3 ? 60 : 80)));

                // Repelling force to push nodes apart
                forceSimulation.force('charge', d3.forceManyBody().strength(-200));

                // Centering force to keep nodes within the view
                forceSimulation.force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
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
                width: '15vw',
                fontSize: '60%',
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
                    {linkText}
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;