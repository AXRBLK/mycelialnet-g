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

  const [backgroundColor, setBackgroundColor] = useState('#303646'); // Background color
  const [linkColor, setLinkColor] = useState('#FF0000'); // Link color
  const colorScheme = ['hotpink', '#cfff66','#66CFFF', '#14190a', '#000000'];
  const circleRadius = 3.5;

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
            const [node, parent, description, url, , , linkedinUrl, tooltip, , , , displayName] = row;
            const nodeName = displayName || node;

            // Only add linkedinUrl if it's not blank
            nodeData.push({
              id: nodeName,
              description: description || '',
              tooltip: tooltip || '',
              url: url || '',
              linkedinUrl: linkedinUrl?.trim() ? linkedinUrl : null // Populate only if not blank
            });

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
      const [node, category, description, url, country, , linkedinUrl, tooltip, , , , displayName] = row;

      const countryCategoryKey = `${country}-${category}`; // Unique ID for internal reference
      const countryDisplayName = row[12] || country; // Display name for country

      if (country) {
        // Create country node if not already added
        if (!countryNodes[countryDisplayName]) {
          countryNodes[countryDisplayName] = { 
            id: countryDisplayName, 
            depth: 1, 
            color: colorScheme[1]
          };
          nodeData.push(countryNodes[countryDisplayName]);
          linkData.push({ source: level0Text, target: countryDisplayName });
        }

        // Create category node for each country-category pair
        if (!categoryNodes[countryCategoryKey]) {
          categoryNodes[countryCategoryKey] = {
            id: countryCategoryKey, // Unique ID for backend
            name: category, // Display only the category
            depth: 2,
            color: colorScheme[2],
            
          };
          nodeData.push(categoryNodes[countryCategoryKey]);
          linkData.push({ source: countryDisplayName, target: countryCategoryKey });
        }

        // Level 3 nodes (individual nodes)
        nodeData.push({
                id: node,
                description: description || '',
                tooltip: tooltip || '',
                url: url || '',
                linkedinUrl: linkedinUrl?.trim() ? linkedinUrl : null, // Add LinkedIn URL only if not blank
                color: colorScheme[3],
                depth: 3
              });
              linkData.push({ source: countryCategoryKey, target: node });
            }
          });

    // Add the level 0 node
    nodeData.unshift({ id: level0Text, depth: 0, color: colorScheme[0] });
  }

        applyConcentricLayout(nodeData, 5);

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

    nodeData.forEach((node) => {
      if (!layers[node.depth]) {
        layers[node.depth] = [];
      }
      layers[node.depth].push(node);
    });

    Object.keys(layers).forEach((depth) => {
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

  const generateTextSprite = (text) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 50;
    context.font = `bold ${fontSize}px Arial`;

    canvas.width = 700;
    canvas.height = 300;

    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = 'white'; //node text color
    context.fillText(text, 10, fontSize+20);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  const renderNode3D = (node) => {
    const group = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({ color: node.color || 'orange' });
    const geometry = new THREE.SphereGeometry(circleRadius, 16, 16);
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: generateTextSprite(node.id || ''),
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(15, 7.5, 1);
    sprite.position.set(0, circleRadius-2,7);
  // The method sprite.position.set(x, y, z) sets the position of the 3D object in the scene. In the context of 3D graphics, the parameters represent the coordinates along the x, y, and z axes, respectively:
  //x: The position along the horizontal axis (left-right direction).
  //y: The position along the vertical axis (up-down direction).
  //z: The position along the depth axis (forward-backward direction).
    group.add(sprite);

    sprite.onBeforeRender = (renderer, scene, camera) => {
      sprite.quaternion.copy(camera.quaternion);
    };

    return group;
  };

  const handleNodeClick = (node, event) => {
    const mouseX = event.clientX || event.touches?.[0]?.clientX || 0;
    const mouseY = event.clientY || event.touches?.[0]?.clientY || 0;

    if (node.tooltip && node.tooltip.trim() !== '') {
      setClickedNode(node);
      setTooltipPos({ x: mouseX-1, y: mouseY+1 });

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
    const graphContainer = document.querySelector('canvas');

    if (node && node.tooltip && node.tooltip.trim() !== '') {
      graphContainer.style.cursor = 'zoom-in';
    } else {
      graphContainer.style.cursor = 'default';
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: backgroundColor,
          width: '100%',
          height: '90vh',
          boxSizing: 'border-box',
        }}
        onClick={() => {
          setClickedNode(null);
          if (fgRef.current) {
            fgRef.current.resumeAnimation();
          }
        }}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <h1 style={{marginBottom:'5px', color:'#cfff66'}}>MycelialNet🌐</h1>
        <div style={{ fontSize:'14px',alignItems: 'center', textAlign: 'center', marginBottom: '12px', backgroundColor:'#cfff66', borderRadius: '3px', color:'black',padding:'12px 18px 12px 18px' }}>
          Select View ↠
          <label style={{ marginLeft: '15px',marginRight: '22px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Industry"
              checked={viewMode === 'Industry'}
              onChange={() => setViewMode('Industry')}
            />
            INDUSTRY 🍄‍🟫
          </label>
            |
          <label style={{ marginLeft: '15px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Country"
              checked={viewMode === 'Country'}
              onChange={() => setViewMode('Country')}
            />
            COUNTRY 🌍
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center',marginBottom:'10px'}}>
          <i style={{ fontSize: '10px', margin: '0 15px 0 0', backgroundColor: 'green', padding: '8px', borderRadius: '3px' }}>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScKplrwxm-Xt7gZF2irypVUa0StEApnWMvnvhgZFOEWAICbKA/viewform" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>
              + Add Company
            </a>
          </i>
          <p style={{ fontSize: '10px', margin: '0 0 0 0', backgroundColor: 'navy', padding: '8px', borderRadius: '3px', }}>
            <a href="mailto:alex.r.blunk@gmail.com?subject=MycelialNet%20Inquiry" style={{ color: 'white', textDecoration: 'none' }}>
            ✉️ Contact
            </a>
          </p>
        </div>

          <p style={{ color:'#d3d3d3',fontSize: '12px', margin: '0 0 10px 0', textAlign:"center" }}>
            <b>⚠️ Under Construction!</b> <br /> 
            If things look wild, drag any node into open space and maybe it will correct itself.. maybe!  <br /> Get in touch otherwise. :)
          </p>

          {/*<a href="https://axrblk.github.io/mycelialnet-g/3D" style={{ color: 'lightgrey', textDecoration: 'none' }}>
            3D
          </a> */}
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
                  width: `40%`,
                  fontSize: '70%',
                  whiteSpace: 'normal',
                }}
              >
                {clickedNode.tooltip}
                <br />
                <br />
                
                {/* LinkedIn link */}
                {clickedNode.linkedinUrl && (
                  <a
                    href={clickedNode.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{pointerEvents: 'auto' }}
                  >
                    <img src={`${process.env.PUBLIC_URL}/linkedin.png`} alt="LinkedIn" style={{ width: '15px', marginLeft: '10px' }} />
                  </a>
                )}{clickedNode.url && (
                  <a
                    href={clickedNode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'lightblue', margin: '5px 5px 5px 10px', pointerEvents: 'auto', textDecoration:'none' }}
                  >
                    {linkText}
                  </a>
                )}
                
                <br />
                
                
                
                
                
              </div>
            )}
          </>
        )}
        <button
          onClick={scrollToBottom}
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
            fontSize: '8px',
            cursor: 'zoom-in',
            zIndex: 1000,
          }}
        >
          Full Screen
        </button>
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '100px',
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
        <div style={{ display: 'flex', alignItems: 'center', position: 'fixed', bottom: '30px', left: '30px' }}>
          <p style={{ fontSize: '8px', margin: '0 5px 0 0' }}>Created by</p>
          <a href="https://www.linkedin.com/in/alblunk/" target="_blank" rel="noopener noreferrer">
            <img src={`${process.env.PUBLIC_URL}/blunkworks.png`} alt="Blunkworks" style={{ width: '65px' }} />
          </a> 
        </div>  
      </div>
    </div>
  );
}

export default App;