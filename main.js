// Imports for stylesheets packed using Vite and external libs (D3 & Leaflet)
import './styles/css_reset.css'
import './styles/style.css'
import 'leaflet/dist/leaflet.css';
import L from "leaflet";
import * as d3 from "d3";

// API Endpoint hosted externally
const API_ENDPOINT = "http://34.147.162.172/Circles/Towns/";

// Page objects for the map and D3
const map = L.map('map', {center: [53.0, 2.0], zoom: 5});
const svg = d3.select(map.getPanes().overlayPane).append("svg")
    .style("position", "absolute");
const vectorGroup = svg.append("g").attr("class", "leaflet-zoom-hide");


// Page State
let TownCount = 50;
let Towns = [];

// Ensure no methods are executed before the page is ready
window.onload = () => {
    InitMap();
    RegisterEvents();
    UpdateValue();
    FetchData();
}

// Register events on interactable elements
function RegisterEvents() {
    document.getElementById("number").oninput = UpdateValue;
    document.getElementById("fetch").onclick = FetchData;
}

// Initialise Leaflet with a default tile layer
function InitMap() {
    const alidade = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Stadia Maps',
        minZoom: 2,
        maxZoom: 18,
    }).addTo(map);
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
    })
    const satelite = L.tileLayer('http://services.arcgisonline.com/ArcGis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    })
    L.control.layers({"Stadia Alidade Smooth": alidade, "OSM OpenTopo": topo, "Esri Satellite": satelite}).addTo(map);
}

// Fetch the towns from the API, process the data slightly as to return on the list in a more logical order
function FetchData() {
    fetch(API_ENDPOINT + TownCount).then(response => {
        response.json().then(d => {
            // Sort the data order by towns
            Towns = d.sort((a, b) => {
                return (a.Town.toUpperCase() < b.Town.toUpperCase()) ? -1 : 1
            });
            UpdateD3();
        })
    })
}

// Recompute offsets for the SVG relative to the map
function UpdateLayer() {
    const bounds = map.getBounds();
    const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

    svg.attr("width", bottomRight.x - topLeft.x)
        .attr("height", bottomRight.y - topLeft.y)
        .style("left", `${topLeft.x}px`)
        .style("top", `${topLeft.y}px`);

    vectorGroup.attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`);
}

function UpdateD3() {
    // Re-render list of all towns
    d3.select("#list").selectAll("li").data(Towns).join("li").html(d => {
        return `<h2>${d.Town}</h2><sub>${d.County}</sub><p>Population: <b>${d.Population}</b></p>`;
    }).on("click", (e, d) => { // Add Click event to list items to move map
        map.flyTo(d, 12);
    })

    UpdateLayer(); // Update the SVG canvas size and position
    // Compute the range of the values
    const maxPop = Towns.length === 1 ? Towns[0].Population : (Towns.reduce((a, b) => Math.max(a.Population ?? a, b.Population)));

    const vectorTransition = d3.transition()
        .duration(250)
        .ease(d3.easeQuad);
    // Append Circles to map
    const circles = vectorGroup.selectAll("circle")
        .data(Towns)  // Bind the data array to the circles
        .join("circle")  // Create circles for each data point
        .transition(vectorTransition)
        .attr("r", (d) => (d.Population / maxPop) * 20 + 5)
        .attr("fill", "red")
        .attr("opacity", (d) => (d.Population / maxPop) + 0.1)
        // .attr("data-point", (d)=>JSON.stringify(d))

    // Update the position of each circle based on its projected coordinates
    circles.attr("cx", d => projectPoint(d.lat, d.lng)[0])
        .attr("cy", d => projectPoint(d.lat, d.lng)[1])

    // Add Labels to circles & Tool Tips
    vectorGroup.selectAll("circle").on("mouseover", (e, d) => {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.opacity = "1";
        tooltip.style.top = e.clientY + "px";
        tooltip.style.left = e.clientX + "px";
        tooltip.innerHTML = `<h1>${d.Town}</h1>
      <sub>${d.County}</sub>
      <p>Population: <b>${d.Population}</b></p>`;
    })
    vectorGroup.selectAll("circle").on("mousemove", (e, d) => {
        const tooltip = document.getElementById("tooltip");
        tooltip.style.top = e.clientY + "px";
        tooltip.style.left = e.clientX + "px";
    })
    vectorGroup.selectAll("circle").on("mouseout", (e, d) => {
        document.getElementById("tooltip").style.opacity = "0";
    })
}


// Update the SVG's position and redraw when the map moves or zooms
map.on("moveend", function () {
    UpdateD3();  // Redraw elements to match the new map state
});

// Trigger a resize on initial load to correctly position the SVG
map.on("zoomend", function () {
    UpdateD3();
});

function projectPoint(x, y) {
    // Based on https://bost.ocks.org/mike/leaflet/
    const point = map.latLngToLayerPoint(new L.LatLng(x, y));
    return [point.x, point.y];
}

function UpdateValue() {
    TownCount = document.getElementById("number").value;
    document.getElementById("fetch").innerText = `Load ${TownCount} Towns`
}