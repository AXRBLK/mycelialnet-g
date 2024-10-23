import React, { useEffect, useState, useRef } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import axios from 'axios';
import { forceLink, forceManyBody, forceCenter } from 'd3-force';

function App() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clickedNode, setClickedNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState('Industry');
  const fgRef = useRef();

  const colorScheme = ['#ffffff', '#66CFFF', '#cfff66', '#ffffff', '#ffffff'];
  const circleRadius = 10;

  const level0Text = "🌍";
  const linkText = "🌐 Website";

  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    words.forEach(word => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && line !== '') {
        lines.push(line);
        line = word + ' ';
      } else {
        line = testLine;
      }
    });
    lines.push(line.trim());
    return lines;
  };

  useEffect(() => {
    const fetchData = async () => {
      const sheetId = '1Ci4Hay8-cHgqq9L8LZV6WIH5rgn8BVJa6018xEmdKTo';
      const apiKey = 'AIzaSyCvCL5fqdrjGj_WjMt_fVDpPLWYSSLRjs8';
      const range = 'Main!A1:N500';
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
            const [node, parent, description, url, , , , tooltip, , , , displayName] = row;
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
            if (index === 0) return; // Skip header row
            const [node, category, description, url, country, , , tooltip, , , , displayName] = row;

            const countryCategoryKey = `${country}-${category}`;
            const countryDisplayName = row[12] || country; // Use column L (index 11) for country name

            if (country) {
              if (!countryNodes[countryDisplayName]) {
                countryNodes[countryDisplayName] = { id: countryDisplayName, depth: 1, color: colorScheme[1] };
                nodeData.push(countryNodes[countryDisplayName]);
                linkData.push({ source: level0Text, target: countryDisplayName });
              }

              if (!categoryNodes[countryCategoryKey]) {
                categoryNodes[countryCategoryKey] = {
                  id: countryCategoryKey,
                  name: category,
                  depth: 2,
                  color: colorScheme[2],
                  tooltip: tooltip || `Category: ${category}`,
                };
                nodeData.push(categoryNodes[countryCategoryKey]);
                linkData.push({ source: countryDisplayName, target: countryCategoryKey });
              }

              nodeData.push({
                id: node,
                description: description || '',
                tooltip: tooltip || '',
                url: url || '',
                color: colorScheme[3],
                depth: 3
              });
              linkData.push({ source: countryCategoryKey, target: node });
            }
          });

          nodeData.unshift({ id: level0Text, depth: 0, color: colorScheme[0] });
        }

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

  const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };


  const applyConcentricLayout = (nodeData, radiusStep) => {
    const layers = {};

    nodeData.forEach(node => {
      if (!layers[node.depth]) {
        layers[node.depth] = [];
      }
      layers[node.depth].push(node);
    });

    Object.keys(layers).forEach(depth => {
      const layer = layers[depth];
      const angleStep = (20 * Math.PI) / layer.length;
      layer.forEach((node, i) => {
        const angle = i * angleStep;
        const radius = radiusStep * depth;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      });
    });
  };

  const graphData = { nodes, links };

  const paintNode = (node, ctx, globalScale) => {
    let fontSize = Math.max(2.5, 3 / globalScale);
    let bckgDimensions = null;

    if (node.depth === 0) {
      fontSize *= 20;
      ctx.font = `bold ${fontSize}px "Courier New"`;
    } else if (node.depth === 1) {
      fontSize *= 1;
      ctx.font = `bold ${fontSize}px "Courier New" `;
    } else if (node.depth === 2) {
      fontSize *= 1.5;
      ctx.font = `bold ${fontSize}px "Courier New" `;
    } else if (node.depth === 3) {
      fontSize *= 1.5;
      ctx.font = `bold ${fontSize}px "Courier New" `;
    } else {
      fontSize *= 1.25;
      ctx.font = `bold ${fontSize}px "Courier New"`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Highlight the clicked node after the tooltip is displayed
    if (clickedNode && clickedNode.id === node.id) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'black';
    }

    if (node.depth <= 1) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, circleRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || 'orange';
      ctx.fill();

      if (clickedNode && clickedNode.id === node.id) {
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
      bckgDimensions = [textWidth, fontSize];
      ctx.fillStyle = node.color || 'orange';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

      if (clickedNode && clickedNode.id === node.id) {
        ctx.lineWidth = 4;
        ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
      }

      ctx.fillStyle = 'black';
      ctx.fillText(text, node.x, node.y);
    }

    node.bckgDimensions = bckgDimensions || [circleRadius * 5, circleRadius * 5];
  };

  const handleNodeClick = (node, event) => {
    const mouseX = event.clientX || event.touches?.[0]?.clientX || 0;
    const mouseY = event.clientY || event.touches?.[0]?.clientY || 0;

    // Prevent tooltip for level 2 nodes in 'Country' view mode
    if (viewMode === 'Country' && node.depth === 2) {
      setClickedNode(null);
      return;
    }

    // Only show tooltip if the node has a non-empty tooltip
    if (node.tooltip && node.tooltip.trim() !== '') {
      setClickedNode(node);
      setTooltipPos({ x: mouseX -10, y: mouseY -10 });

      // Pause the simulation when a tooltip is shown
      if (fgRef.current) {
        fgRef.current.pauseAnimation();
      }
    } else {
      setClickedNode(null);

      // Resume the simulation when the tooltip is closed
      if (fgRef.current) {
        fgRef.current.resumeAnimation();
      }
    }
    event.stopPropagation();
  };

  const handleNodeHover = (node) => {
    const graphContainer = document.querySelector("canvas");

    // Disable hover effect for level 2 nodes in 'Country' view mode
    if (viewMode === 'Country' && node?.depth === 2) {
      graphContainer.style.cursor = "default";
      return;
    }

    if (node && node.tooltip && node.tooltip.trim() !== "") {
      graphContainer.style.cursor = "zoom-in"; // Show magnifying glass if tooltip exists
    } else {
      graphContainer.style.cursor = "default";
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div
        style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        onClick={() => {
          setClickedNode(null);

          // Resume the simulation when the tooltip is closed
          if (fgRef.current) {
            fgRef.current.resumeAnimation();
          }
        }}
        onTouchStart={(e) => e.stopPropagation()} // Handle touch events for mobile devices
      >
        <h1>MycelialNet🌐</h1>
        <div style={{ alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
          <label>
            <input
              type="radio"
              name="viewMode"
              value="Industry"
              checked={viewMode === 'Industry'}
              onChange={() => setViewMode('Industry')}
            />
            Industry 🍄‍🟫
          </label>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Country"
              checked={viewMode === 'Country'}
              onChange={() => setViewMode('Country')}
            />
            Country 🌍
          </label>
        </div>
            <i style={{ fontSize: '10px', margin: '0 5px 0 0', backgroundColor: 'green', padding: '5px', borderRadius: '5px', fontWeight: 'bold' }}>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLScKplrwxm-Xt7gZF2irypVUa0StEApnWMvnvhgZFOEWAICbKA/viewform" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>
            + Add Company
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
          <p style={{ fontSize: '8px', margin: '0 0 20px 0', textAlign:"center" }}>
            <b>⚠️ Under Construction!</b> <br /> 
            If things look wild, drag any node into open space and<br />  maybe it will correct itself.. maybe! Get in touch otherwise. :)
          </p>

          <a href="https://axrblk.github.io/mycelialnet-g/3D" style={{ color: 'lightgrey', textDecoration: 'none' }}>
            3D
          </a>

        {loading ? (
          <p>Loading data...</p>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef} // Attach the ForceGraph2D reference
              graphData={graphData}
              nodeCanvasObject={paintNode}
              linkCurvature={0.0}
              nodeAutoColorBy="depth"
              d3Force={(forceSimulation) => {
                forceSimulation.force('link', forceLink().id((d) => d.id).distance(-500));

                // No collision force to prevent nodes moving around due to tooltips
                forceSimulation.force('charge', forceManyBody().strength(300));

                // Centering force to keep nodes within the view
                forceSimulation.force('center', forceCenter(window.innerWidth / 2, window.innerHeight / 2));
              }}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover} // Set hover effect
            />
            {clickedNode && (
              <div
                style={{
                  position: 'absolute',
                  top: `${tooltipPos.y}px`,
                  left: `${tooltipPos.x}px`,
                  padding: '15px',
                  color: 'white',
                  backgroundColor: '#505050',
                  pointerEvents: 'auto',
                  zIndex: 1000,
                  width: `25%`,
                  fontSize: '70%',
                  whiteSpace: 'normal',
                }}
              >
                {clickedNode.tooltip}
                 <br />
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
         {/* Scroll to Bottom Button */}
      <button
        onClick={scrollToBottom}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '30px',
          backgroundColor: '#66CFFF',
          color: 'black',
          borderRadius: '50%',
          border: 'none',
          width: '50px',
          height: '50px',
          fontSize: '8px',
          cursor: 'zoom-in',
          zIndex: 1000,
        }}
      >
        Full Screen
      </button>
{/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          backgroundColor: '#66CFFF',
          color: 'black',
          borderRadius: '50%',
          border: 'none',
          width: '50px',
          height: '50px',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        ↥
      </button>
      </div>
    </div>
  );
}

export default App;