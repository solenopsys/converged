 

 export default {
    content: [
      "./src/**/*.{js,ts,jsx,tsx}", 
      
      "./confs/index.html"
    ],
    corePlugins: {
      preflight: false, // отключает reset стили
    },
    theme: {
      extend: {},
    },
    plugins: [],
  }