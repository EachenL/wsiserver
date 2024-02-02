import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-edgebuffer'
const MapView = () => {
  const mapContainerRef = useRef(null); // 用来引用地图容器DOM元素
  const mapInstance = useRef(null); // 用来持久化地图实例
  const [wsiFiles, setWsiFiles] = useState([]);
  const [selectedWsi, setSelectedWsi] = useState('');
  const url = "http://localhost:31791";
  // Function to fetch WSI files list from the backend
  const fetchWsiFiles = async () => {
    try {
      console.log('try to fetch wsi files')
      const response = await fetch(`${url}/wsi-list`);
      const files = await response.json();
      setWsiFiles(files);
      console.log('fetch wsi files complete')
    } catch (error) {
      console.error('Failed to fetch WSI files:', error);
    }
  };
  // Function to load the selected WSI
  const loadSelectedWsi = async (wsiPath) => {
    // 这里可以添加加载新切片的逻辑，例如请求新的切片属性
    console.log(`fetch ${wsiPath}`)
    const propsResponse = await fetch(`${url}/props/${encodeURIComponent(wsiPath)}`);
    const newProps = await propsResponse.json();

    // 根据新切片的属性更新地图
    // 注意：此处假设你有一个函数来更新地图视图，你可能需要根据你的实际代码进行调整
    updateMapView(newProps);
  };
  // Function to fetch properties
  const getProps = async (wsiPath) => {
    const response = await fetch(`${url}/props/${encodeURIComponent(wsiPath)}`);
    const data = await response.json();
    return data;
  };

  // Function to reset bounds based on the given mapView and zoom2size
  const resetBounds = (mapView, zoom2size) => {
    const zoom = mapView.getZoom();
    const slideSize = zoom2size[zoom];
    const topLeft = mapView.unproject(L.point(0, 0), zoom);
    const bottomRight = mapView.unproject(L.point(slideSize.x, slideSize.y), zoom);
    mapView.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
  };

  // Function to get center based on the given zoom2size and mapView
  const getCenter = (zoom2size, mapView) => {
    const zoom = mapView.getZoom();
    const slideSize = zoom2size[zoom];
    return mapView.unproject(L.point(slideSize.x / 2, slideSize.y / 2), zoom);
  };

  // Initialize the map view
  const initview = async () => {
    console.log('initview called')
    // If the map has already been initialized, do not run the initialization again
    if (mapInstance.current) {
      console.log("mapInstance exists");
      return;
    }
    console.log("initializing mapContainerRef")
    const props = await getProps(selectedWsi);
    const initView = L.map(mapContainerRef.current, {
      center: [0, 0],
      zoom: props.default_zoom,
      crs: L.CRS.Simple,
      tileSize: props.tile_size,
      attributionControl: false,
    });
    console.log("mapContainerRef Initialized")
    L.tileLayer(`${url}/tile/{z}/{x}/{y}`, {
      padding: 1,
      keepBuffer: 1,
      edgeBufferTiles: 3
    }).addTo(initView);

    initView.on("zoomend", () => {
      resetBounds(initView, props.zoom2size);
    });

    initView.setMinZoom(props.min_zoom);
    initView.setMaxZoom(props.max_zoom);
    initView.setView(getCenter(props.zoom2size, initView));

    // Store the map instance in the ref after initialization
    mapInstance.current = initView;
    console.log('mapInstance.current Initialized')
  };

  useEffect(() => {

    fetchWsiFiles();
    // Initialize the map view
    initview();
    // Cleanup function to run when the component is unmounted
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove(); // Remove the map instance
        mapInstance.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array ensures this effect only runs once on mount
  
  const handleSelectChange = async(event) => {
    const selectedValue = event.target.value;
    setSelectedWsi(selectedValue);
    // Load the selected WSI
    await loadSelectedWsi(selectedValue);
  }
  
  // 假设的 updateMapView 函数，根据新的属性更新地图视图
  const updateMapView = (props) => {
    console.log('updateMapView Called')
    // 你可能需要根据你的地图库的API来调整这个函数
    if (mapInstance.current) {
      console.log('mapInstance.current exist')
      // delete mapInstance.current, and re-init a new map
      mapInstance.current.remove();
      mapInstance.current = null;
      // mapContainerRef.current.remove();
      // mapContainerRef.current = null;
      initview();
      // if (mapInstance.current.tileLayer) {
      //   mapInstance.current.removeLayer(mapInstance.current.tileLayer)
      //   console.log('remove tileLayer')
      // }

      // const { tile_size, max_zoom, default_zoom, bounds, zoom2size } = props;

      // // 更新瓦片图层
      // console.log('update tile layer')
      // const newTileLayer = L.tileLayer(`${url}/tile/{z}/{x}/{y}`, {
      //   padding: 1,
      //   keepBuffer: 1,
      //   edgeBufferTiles: 2
      // });
      // newTileLayer.addTo(mapInstance.current);
      // mapInstance.current.tileLayer = newTileLayer
      // console.log('reset Bounds')
      // mapInstance.current.on("zoomend", () => {
      //   resetBounds(mapInstance.current, props.zoom2size);
      // });
      // // 更新地图的缩放级别和中心点
      // console.log('set min zoom')
      // mapInstance.current.setMinZoom(props.min_zoom);
      // console.log('set max zoom')
      // mapInstance.current.setMaxZoom(max_zoom);
      // console.log('set view')
      // mapInstance.current.setView(getCenter(props.zoom2size, mapInstance.current));
      // console.log('updated center')
    }
  };
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh'}}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000}}>
        <select value={selectedWsi} onChange={handleSelectChange}>
          {wsiFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MapView;
