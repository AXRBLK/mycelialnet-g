import React, { useEffect, useState, useRef } from 'react';
import { ForceGraph3D } from 'react-force-graph';
import axios from 'axios';
import { forceLink, forceManyBody, forceCenter } from 'd3-force';
import * as THREE from 'three';

function App() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clickedNode, setClickedNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState('Industry');
  const fgRef = useRef();

  const [backgroundColor, setBackgroundColor] = useState('#777777'); // Background color
  const [linkColor, setLinkColor] = useState('#FF0000'); // Link color
  const colorScheme = ['#ffffff', '#66CFFF', '#cfff66', '#ffffff', '#ffffff'];
  const circleRadius = 2;

  const level0Text = "🌍";
  const linkText = "🌐 Website";

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
            const countryDisplayName = row[12] || country; 

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
        node.z = Math.random() * 100 - 50;
      });
    });
  };

  const graphData = { nodes, links };

  // Helper to generate a sprite for node labels that contains text and emojis
  const generateTextSprite = (text) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 50;
    context.font = `${fontSize}px Arial`;

    // Adjust canvas width/height dynamically based on text length
    canvas.width = context.measureText(text).width + 20;
    canvas.height = fontSize + 20;

    // Redraw the text
    context.font = `${fontSize}px Arial`;
    context.fillStyle = 'black';
    context.fillText(text, 10, fontSize);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  // Render the node as a sphere with a text label above it that faces the camera
  const renderNode3D = (node) => {
    const group = new THREE.Group();

    // Node sphere
    const material = new THREE.MeshBasicMaterial({ color: node.color || 'orange' });
    const geometry = new THREE.SphereGeometry(circleRadius, 16, 16);
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Text label using sprite
    const spriteMaterial = new THREE.SpriteMaterial({
      map: generateTextSprite(node.id || ''),
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(15, 7.5, 1); // Adjust size
    sprite.position.set(0, circleRadius + 5, 0); // Position above the sphere
    group.add(sprite);

    // Ensure text always faces the camera
    sprite.onBeforeRender = (renderer, scene, camera) => {
      sprite.quaternion.copy(camera.quaternion); // Make the label face the camera
    };

    return group;
  };

  const handleNodeClick = (node, event) => {
    const mouseX = event.clientX || event.touches?.[0]?.clientX || 0;
    const mouseY = event.clientY || event.touches?.[0]?.clientY || 0;

    if (node.tooltip && node.tooltip.trim() !== '') {
      setClickedNode(node);
      setTooltipPos({ x: mouseX, y: mouseY });

      if (fgRef.current) {
        fgRef.current.pauseAnimation();
      }
    } else {
      setClickedNode(null);

      if (fgRef.current) {
        fgRef.current.resumeAnimation();
      }
    }
    event.stopPropagation();
  };

  const handleNodeHover = (node) => {
    const graphContainer = document.querySelector("canvas");

    if (node && node.tooltip && node.tooltip.trim() !== "") {
      graphContainer.style.cursor = "zoom-in"; 
    } else {
      graphContainer.style.cursor = "default";
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div
        style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: backgroundColor }}
        onClick={() => {
          setClickedNode(null);
          if (fgRef.current) {
            fgRef.current.resumeAnimation();
          }
        }}
        onTouchStart={(e) => e.stopPropagation()} 
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
            Industry
          </label>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Country"
              checked={viewMode === 'Country'}
              onChange={() => setViewMode('Country')}
            />
            Country
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
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <>
            <ForceGraph3D
              ref={fgRef}
              graphData={graphData}
              nodeThreeObject={renderNode3D}
              linkCurvature={0.0}
              linkColor={linkColor}
              nodeAutoColorBy="depth"
              backgroundColor={backgroundColor}
              d3Force={(forceSimulation) => {
                forceSimulation.force('link', forceLink().id((d) => d.id).distance(200));

                forceSimulation.force('charge', forceManyBody().strength(300));

                forceSimulation.force('center', forceCenter(0, 0, 0));
              }}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
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
      </div>
    </div>
  );
}

export default App;