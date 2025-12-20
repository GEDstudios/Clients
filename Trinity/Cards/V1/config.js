export const config = {
    type: "project",
    title: "Trinity - Cards",
    description: "Mobile & Desktop Variants.",
    navDepth: "../../../",
    
    sections: [
        {
            title: "Mobile",
            files: [
                { fileName: "Mobile/Slide_Gradients.lottie", loop: true},
                { fileName: "Mobile/Slide_Squares.lottie", loop: true},
                { fileName: "Mobile/Slide_Stroke.lottie", loop: true},

            ]
        },
        {
            title: "Web",
            files: [
                { fileName: "Web/Slide1_Shapes.lottie", loop: true, fullWidth: true},
                { fileName: "Web/Slide2_Blur.lottie", loop: true, fullWidth: true},
                { fileName: "Web/Slide3_Gradients.lottie", loop: true, fullWidth: true},
            ]
        }
    ]
};