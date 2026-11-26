import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {LocateFixed} from 'lucide-react';
import {Button} from './ui';
export default function CareMap({providers,area,onSelect,selected}) {
  const div=useRef(),map=useRef(),layers=useRef(),choose=useRef(onSelect),fit=useRef(()=>{}),lastBounds=useRef(null),[tileError,setTileError]=useState(false);choose.current=onSelect;
  useEffect(()=>{
    const m=L.map(div.current,{scrollWheelZoom:false,zoomControl:true}).setView([area.lat,area.lon],12);map.current=m;
    const tile=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'}).addTo(m);
    tile.on('tileerror',()=>setTileError(true));tile.on('load',()=>{if(div.current?.querySelector('.leaflet-tile-loaded'))setTileError(false);});
    layers.current=L.layerGroup().addTo(m);const ro=new ResizeObserver(()=>m.invalidateSize());ro.observe(div.current);
    return()=>{ro.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    const m=map.current;if(!m)return;layers.current.clearLayers();const coords=[];
    L.circleMarker([area.lat,area.lon],{radius:7,color:'#ffffff',weight:3,fillColor:'#456d98',fillOpacity:1}).bindTooltip('Search area centre').addTo(layers.current);
    for(const [i,p] of providers.entries()) {
      if(p.lat==null||p.lon==null)continue;coords.push([p.lat,p.lon]);
      const icon=L.divIcon({className:'map-pin-wrap',html:`<span class="map-pin ${selected===p.id?'selected':''}">${i+1}</span>`,iconSize:[36,42],iconAnchor:[18,42]});
      const marker=L.marker([p.lat,p.lon],{icon,title:`${i+1}. ${p.name}`,alt:`Open ${p.name}`,keyboard:true}).addTo(layers.current);
      marker.getElement()?.setAttribute('aria-label',`Open ${p.name}`);
      const tip=document.createElement('span');tip.textContent=p.name;marker.bindTooltip(tip);marker.on('click',()=>choose.current(p));
    }
    fit.current=()=>coords.length?m.fitBounds(L.latLngBounds([...coords,[area.lat,area.lon]]),{padding:[42,42],maxZoom:14,animate:false}):m.setView([area.lat,area.lon],13,{animate:false});const key=JSON.stringify([area.id,coords]);if(lastBounds.current!==key){fit.current();lastBounds.current=key;}
  },[providers,area,selected]);
  return <section className="map-section" aria-label="Provider map"><div ref={div} className="map-canvas" aria-label="Interactive map of childcare providers"/><Button className="fit-map" onClick={()=>fit.current()}><LocateFixed/>Fit results</Button>{tileError&&<div className="map-error" role="status">The street map could not load. Provider locations and the results list remain available.</div>}<p className="map-caption">Pins are approximate. Distances are straight-line from the selected area centre.</p></section>;
}
