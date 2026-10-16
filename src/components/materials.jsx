const [materials, setMaterials] = useState([]);
const [loadingMaterials, setLoadingMaterials] = useState(true);

useEffect(() => {
  fetch("http://localhost:5000/api/materials")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        setMaterials(data.materials);
      }
    })
    .catch((error) => {
      console.error("Failed to load materials:", error);
    })
    .finally(() => {
      setLoadingMaterials(false);
    });
}, []);