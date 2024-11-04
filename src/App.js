import React, { useEffect, useState, useRef } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import axios from 'axios';
import { forceLink, forceManyBody, forceCenter } from 'd3-force';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clickedNode, setClickedNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [viewMode, setViewMode] = useState('Industry');
  const [searchQuery, setSearchQuery] = useState('');

  
  const fgRef = useRef();
  const colorScheme = ['#ffffff', '#cfff66', '#66CFFF', 'transparent', 'transparent'];
  const circleRadius = 10;

  // Configurable highlight styling
  const highlightStyle = {
    color: '#cfff66',
    thickness: 8,
    fontSizeMultiplier: 4,
  };

  const infoTooltipText = (
  <div>  
    <p>What is this? </p>
    <p>🧠 A globally-fueled network of Fungi related organizations. Use for research, discovery, & job searches.</p>
    <p>Very open to ideas or feedback! Assignment of the industry category is largely determined off of a quick scan of the primary focus of the organization -- but as with most things with mushrooms, there are quite a lot of companies adding innovations to multiple sectors of the industry.</p>
    <p>⚠️ Under Construction!</p>
    <p><strong>UX:</strong> If things look wild, drag any node into open space and maybe it will correct itself... maybe!</p>
    <p><strong>Search:</strong> View this application on a computer to be able to search specific for categories or companies!</p>
    <p>
    <strong style={{fontSize:'.3em'}}>🍄</strong>
    <strong style={{fontSize:'2em'}}>🌲</strong>
    <strong style={{fontSize:'1.5em'}}>🌲</strong>
    <strong style={{fontSize:'.5em'}}>🍄</strong>
    <strong style={{fontSize:'2.5em'}}>🌲</strong>
    <strong style={{fontSize:'.5em'}}>🍄</strong>
    <strong style={{fontSize:'.3em'}}>🍄</strong>
    <strong style={{fontSize:'1em'}}>🌲</strong>
    <strong style={{fontSize:'2em'}}>🌲</strong>
    <strong style={{fontSize:'.3em'}}>🍄</strong>
    <strong style={{fontSize:'.5em'}}>🍄</strong>
    </p>
    <p>:)</p>
  </div>
  );

 

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
            if (index === 0) return;
            const [node, parent, description, url, , , linkedinUrl, tooltip, , , , displayName] = row;
            const nodeName = displayName || node;

            nodeData.push({
              id: nodeName,
              description: description || '',
              tooltip: tooltip || '',
              url: url || '',
              linkedinUrl: linkedinUrl?.trim() ? linkedinUrl : null
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
            if (index === 0) return;
            const [node, category, description, url, country, , linkedinUrl, tooltip, , , , displayName] = row;

            const countryCategoryKey = `${country}-${category}`;
            const countryDisplayName = row[12] || country;

            if (country) {
              if (!countryNodes[countryDisplayName]) {
                countryNodes[countryDisplayName] = { id: countryDisplayName, depth: 1, color: colorScheme[1] };
                nodeData.push(countryNodes[countryDisplayName]);
                linkData.push({ source: "🌍", target: countryDisplayName });
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
                linkedinUrl: linkedinUrl?.trim() ? linkedinUrl : null,
                color: colorScheme[3],
                depth: 3
              });
              linkData.push({ source: countryCategoryKey, target: node });
            }
          });

          nodeData.unshift({ id: "🌍", depth: 0, color: colorScheme[0] });
        }

        applyGridLayout(nodeData);
        setNodes(nodeData);
        setLinks(linkData);
      } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData(); 
  
  }, [viewMode]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const applyGridLayout = (nodeData) => {
    const parentNodes = {};
    nodeData.forEach(node => {
      if (!parentNodes[node.depth]) parentNodes[node.depth] = [];
      parentNodes[node.depth].push(node);
    });

    Object.keys(parentNodes).forEach(depth => {
      const nodes = parentNodes[depth];
      const gridSize = Math.ceil(Math.sqrt(nodes.length));
      const spacing = 1 * depth;

      nodes.forEach((node, i) => {
        const xPos = (i % gridSize) * spacing - (gridSize / 2) * spacing + 5;
        const yPos = Math.floor(i / gridSize) * spacing - (gridSize / 2) * spacing;
        node.x = xPos;
        node.y = yPos;
      });
    });
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const handleNodeClick = (node, event) => {
    const mouseX = event.clientX || event.touches?.[0]?.clientX || 0;
    const mouseY = event.clientY || event.touches?.[0]?.clientY || 0;

    if (node.tooltip && node.tooltip.trim() !== '') {
      setClickedNode(node);
      setTooltipPos({ x: mouseX - 10, y: mouseY - 10 });
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
    graphContainer.style.cursor = node ? "pointer" : "default";

    if (node && node.tooltip && node.tooltip.trim() !== "") {
      graphContainer.style.cursor = "zoom-in"; // Show magnifying glass if tooltip exists
    } else {
      graphContainer.style.cursor = "default";
    }
  };

  const handleBackgroundClick = () => {
    setClickedNode(null);
    if (fgRef.current) {
      fgRef.current.resumeAnimation();
    }
  };

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

  const paintNode = (node, ctx, globalScale) => {
    // Font size and maxWidth based on node level (depth)
    let fontSize = Math.max(2.5, 3 / globalScale);
    let maxWidth = 10;

    if (node.depth === 3) {
      fontSize *= 1;
      maxWidth = 15;
    } else if (node.depth === 2) {
      fontSize *= 1;
      maxWidth = 18;
    } else if (node.depth === 1) {
      fontSize *= 1;
      maxWidth = 5;
    } else if (node.depth === 0) {
      fontSize *= 20;
      maxWidth = 80;
    }

    const isMatching = searchQuery && node.id.toLowerCase().includes(searchQuery);
    if (isMatching) {
      fontSize *= highlightStyle.fontSizeMultiplier;
      ctx.fillStyle = highlightStyle.color;
      ctx.fillRect(
        node.x - maxWidth / 2 - 5,
        node.y + fontSize / 2 - 5,
        maxWidth + 10,
        highlightStyle.thickness
      );
    }

    ctx.fillStyle = node.color || 'orange';
    ctx.beginPath();
    ctx.arc(node.x, node.y, circleRadius, 0, 2 * Math.PI, false);
    ctx.fill();

    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';

    const textLines = wrapText(ctx, node.id, maxWidth);
    const textHeight = textLines.length * fontSize;
    textLines.forEach((line, index) => {
      ctx.fillText(line, node.x, node.y - textHeight / 2 + (index + 0.5) * fontSize);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={handleSearchChange}
        style={{
          position: 'fixed',
          bottom: '30px',
          left: '42%',
          padding: '5px',
          border: '1px solid #ccc',
          zIndex: 1000,
          width: '15%',
          backgroundColor: '#cfff66',
          display: window.innerWidth <= 999 ? 'none' : 'block' // Hide on mobile
        }}
      />

      <div
        style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        onClick={handleBackgroundClick}
      >
        <h1 style={{marginBottom:'-10px',marginTop:'-5px',letterSpacing:'-3px',fontSize:'2.5em',}}>MYCELIATED NET<strong style={{fontSize:'.5em',letterSpacing:'-9px'}}>🍄‍🟫🌐🌏</strong></h1>
        <hr style={{border:'1.5px solid #66CFFF',width:'100%'}}/>
        <div style={{ fontSize:'14px',alignItems: 'center', textAlign: 'center',marginTop:'-8px', marginBottom: '12px', backgroundColor:'#cfff66', color:'black',padding:'2px 2% 5px 2%' }}>
          Select View ↠
          <label style={{ marginLeft: '15px',marginRight: '15px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Industry"
              checked={viewMode === 'Industry'}
              onChange={() => setViewMode('Industry')}
            />
            INDUSTRY
          </label>
            |
          <label style={{ marginLeft: '10px' }}>
            <input
              type="radio"
              name="viewMode"
              value="Country"
              checked={viewMode === 'Country'}
              onChange={() => setViewMode('Country')}
            />
            COUNTRY
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center',marginBottom:'10px'}}>
          <button
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={{
              fontSize: '10px',
              margin: '0 15px',
              backgroundColor: '#95343F',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '3px',
              border: 'none',
              cursor: 'help',
              position: 'relative'
            }}
          >
            ?
            {isHovering && (
              <div
                style={{
                  position: 'absolute',
                  top: '-45px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#505050',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  whiteSpace: 'normal',
                  width: '200px',
                  textAlign: 'center',
                  zIndex: 1000,
                }}
              >
                {infoTooltipText}
              </div>
            )}
          </button>


          <i style={{ fontSize: '10px', margin: '0 15px 0 0', backgroundColor: 'green', padding: '8px', borderRadius: '3px' }}>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLScKplrwxm-Xt7gZF2irypVUa0StEApnWMvnvhgZFOEWAICbKA/viewform" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>
              + Add Company
            </a>
          </i>
          <p style={{ fontSize: '10px', margin: '0 0 0 0', backgroundColor: '#11446C', padding: '6px 8px 6px 8px', borderRadius: '3px', }}>
            <a href="mailto:alex.r.blunk@gmail.com?subject=MycelialNet%20Inquiry" style={{ color: 'white', textDecoration: 'none' }}>
            ✉️ Contact
            </a>
          </p>
        </div>

        {loading ? (
          <p>Loading data...</p>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={{ nodes, links }}
              nodeCanvasObject={paintNode}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              linkCurvature={0.25}
              nodeAutoColorBy="depth"
              d3Force={(forceSimulation) => {
                forceSimulation.force('link', forceLink().id((d) => d.id).distance(1000));
                forceSimulation.force('charge', forceManyBody().strength(500));
                forceSimulation.force('center', forceCenter(window.innerWidth / 2, window.innerHeight / 2));
              }}
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