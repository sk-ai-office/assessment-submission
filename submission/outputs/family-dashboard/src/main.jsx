import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
class AppBoundary extends React.Component{constructor(props){super(props);this.state={error:false};}static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<main className="boot"><h1>Something interrupted the dashboard</h1><p>Your saved information is still in the local database.</p><button className="button" onClick={()=>location.reload()}>Reload dashboard</button></main>:this.props.children;}}
createRoot(document.getElementById('root')).render(<AppBoundary><App/></AppBoundary>);
