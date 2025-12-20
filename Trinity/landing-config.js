export const config = {
    type: "landing",
    clientName: "Trinity",
    navDepth: "../", 
    
    theme: {
        brand: "#ba97ff",            
        pageBg: "#030304",           
        cardBg: "rgba(20,20,22,0.6)", 
        lottieBg: {
            dark: "rgba(0,0,0,0.2)",
            light: "rgba(255,255,255,1)"
        }
    },

    projects: [
        {
            category: "Logo Animations",
            main: {
                tag: "Logo",
                badge: "",
                desc: "Logotype & Symbol.",
                path: "Logo/V1/index.html" 
            },
            archives: []
        },
        {
            category: "Cards",
            main: {
                tag: "Cards",
                badge: "",
                desc: "Mobile & Desktop.",
                path: "Cards/V1/index.html" 
            },
            archives: []
        }
    ]
};