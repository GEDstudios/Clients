export const config = {
    type: "landing",
    clientName: "Samplead",
    description: "Preview of lottie animation deliverables", 
    navDepth: "../",

    theme: {
        brand: "#F45326",
        pageBg: "#030304",
        cardBg: "rgba(20,20,22,0.6)",
        lottieBg: {
            dark: "rgba(244,238,236,1)",
            light: "rgba(255,255,255,1)"
        }
    },

    projects: [
        {
            category: "Soft UI",
            main: {
                tag: "Soft UI",
                badge: "V2",
                desc: "Animations displaying the user interface and interactions.",
                path: "Soft_UI/V2/index.html"
            },
            archives: [
                {
                    title: "v1.0",
                    label: "Legacy",
                    path: "Soft_UI/V1/index.html"
                }
            ]
        },
        {
            category: "Icons",
            main: {
                tag: "Icons",
                badge: "V1",
                desc: "Icons.",
                path: "Icons/V1/index.html"
            },
            /*archives: [
                {
                    title: "v1.0",
                    label: "Legacy",
                    path: "Soft_UI/V1/index.html"
                }
            ]*/
        }
    ]
};