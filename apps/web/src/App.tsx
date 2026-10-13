import {useEffect} from 'react';
import {HashRouter,useLocation} from 'react-router-dom';
import {bindFileManager} from '../../../packages/shared-ui/file-manager.js';
import '../../../packages/shared-ui/file-manager.css';
import '../../../packages/shared-ui/work-controls.css';
import {bindMotion} from '../../../packages/shared-ui/motion.js';
import {bindPresentation} from '../../../packages/shared-ui/presentation.js';
import {bindTheme} from '../public/theme.js';
import {LiveRelayProvider} from './live';
import {RelayPage} from './pages/RelayPage';

function Shell(){
 const location=useLocation();
 const path=location.pathname.replace(/^\/today(?=\/|$)/,'/now');
 const destination='https://ctrl.loew.fi/#'+(/^\/(now|runner|night-shift|inspector)(\/|$)/.test(path)?path+location.search:'/now');
 const preview=Boolean((window as Window & {__retainedFixture?:{data_mode?:string}}).__retainedFixture?.data_mode==='synthetic');
 useEffect(()=>bindFileManager(),[]);
 useEffect(()=>{const presentation=bindPresentation(),theme=bindTheme(),motion=bindMotion();return()=>{presentation();theme?.();motion();};},[]);
 useEffect(()=>{if(location.pathname!=='/'&&!preview&&window.location.hostname==='relay.loew.fi')window.location.replace(destination);},[location.pathname,destination,preview]);
 if(location.pathname!=='/')return <main className="relay-home" data-relay-ctrl-handoff><section className="relay-main-panel"><h1>Your work is in CTRL</h1><p>Today, Runner, Inspector and Night Shift are available in CTRL.</p><a href={destination}>Open CTRL</a><p><a href="#/">Back to Relay connections and files</a></p></section></main>;
 return <RelayPage/>;
}

export default function App(){return <HashRouter><LiveRelayProvider><Shell/></LiveRelayProvider></HashRouter>;}
