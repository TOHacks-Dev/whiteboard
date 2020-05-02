let canvas;
let ctx;

let savedImageData;

let dragging = false;
let strokeColor = "black";
let fillColor = "black";
let lineWidth = 2;
let polygonSides = 6;

let currentTool = "brush";
let canvasWidth = 1000;
let canvasHeight = 1000;

let usingBrush = false;
let currentStroke = {};

let app;
let db;
let board;
let allPoints = [];
let ids = [];

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

class ShapeBoundingBox {
    constructor(left, top, width, height) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }
}

class Location {
    constructor(x, y) {
        this.x = x,
            this.y = y;
    }
}

let shapeBoundingBox = new ShapeBoundingBox(0, 0, 0, 0);
let mousedown = new Location(0, 0);
let loc = new Location(0, 0);

document.addEventListener("DOMContentLoaded", setupCanvas);

function setupCanvas() {
    canvas = document.getElementById("my-canvas");
    ctx = canvas.getContext("2d");
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    let canvasSizeData = canvas.getBoundingClientRect();
    canvas.width = canvasWidth = window.innerWidth;
    canvas.height = canvasHeight = window.innerHeight;
    console.log(canvasHeight);
    canvas.addEventListener("mousedown", reactToMouseDown);
    canvas.addEventListener("mousemove", reactToMouseMove);
    canvas.addEventListener("mouseup", reactToMouseUp);
}

function changeTool(toolClicked) {
    document.getElementById("open").className = "";
    document.getElementById("save").className = "";
    document.getElementById("brush").className = "";
    document.getElementById("line").className = "";
    document.getElementById("rectangle").className = "";
    document.getElementById("circle").className = "";
    document.getElementById("ellipse").className = "";
    document.getElementById("polygon").className = "";
    document.getElementById(toolClicked).className = "selected";
    currentTool = toolClicked;
}

function getMousePosition(x, y) {
    let canvasSizeData = canvas.getBoundingClientRect();
    return {
        x: (x - canvasSizeData.left) * (canvas.width / canvasSizeData.width),
        y: (y - canvasSizeData.top) * (canvas.height / canvasSizeData.height)
    };
}

function saveCanvasImage() {
    savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function redrawCanvasImage() {
    ctx.putImageData(savedImageData, 0, 0);
}

function updateRubberbandSizeData(loc) {
    shapeBoundingBox.width = Math.abs(loc.x - mousedown.x);
    shapeBoundingBox.height = Math.abs(loc.y - mousedown.y);

    if (loc.x > mousedown.x) {
        shapeBoundingBox.left = mousedown.x;
    } else {
        shapeBoundingBox.left = loc.x;
    }

    if (loc.y > mousedown.y) {
        shapeBoundingBox.top = mousedown.y;
    } else {
        shapeBoundingBox.top = loc.y;
    }
}

function getAngleUsingXAndY(mouselocX, mouselocY) {
    let adjacent = mousedown.x - mouselocX;
    let opposite = mousedown.y - mouselocY;

    return radiansToDegrees(Math.atan2(opposite, adjacent));
}

function radiansToDegrees(rad) {
    if (rad < 0) {
        return (360.0 + (rad * (180 / Math.PI))).toFixed(2);
    } else {
        return (rad * (180 / Math.PI)).toFixed(2);
    }
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function getPolygonPoints() {
    let angle = degreesToRadians(getAngleUsingXAndY(loc.x, loc.y));

    let radiusX = shapeBoundingBox.width;
    let radiusY = shapeBoundingBox.height;
    let polygonPoints = [];

    for (let i = 0; i < polygonSides; i++) {
        polygonPoints.push(new Location(loc.x + radiusX * Math.sin(angle),
            loc.y - radiusY * Math.cos(angle)));

        angle += 2 * Math.PI / polygonSides;
    }
    return polygonPoints;
}

function getPolygon(shouldDraw) {

    let points = [];
    let polygonPoints = getPolygonPoints();

    if (shouldDraw) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonSides; i++) {
            ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        ctx.closePath();
    } else {
        points = [polygonPoints[0].x, polygonPoints[0].y];for (let i = 1; i < polygonSides; i++) {
            points.push(polygonPoints[i].x, polygonPoints[i].y)
        }
    }

    return points;
}

function drawRubberbandShape(loc) {
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    if (currentTool == "brush") {
        drawCur();
    } else if (currentTool == "line") {
        ctx.beginPath();
        ctx.moveTo(mousedown.x, mousedown.y);
        ctx.lineTo(loc.x, loc.y);
        ctx.stroke();
    } else if (currentTool == "rectangle") {
        ctx.strokeRect(shapeBoundingBox.left, shapeBoundingBox.top, shapeBoundingBox.width, shapeBoundingBox.height);
    } else if (currentTool == "circle") {
        let radius = shapeBoundingBox.width;
        ctx.beginPath();
        ctx.arc(mousedown.x, mousedown.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    } else if (currentTool == "ellipse") {
        let radiusX = shapeBoundingBox.width / 2;
        let radiusY = shapeBoundingBox.height / 2;
        ctx.beginPath();
        ctx.ellipse(mousedown.x, mousedown.y, radiusX, radiusY, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
    } else if (currentTool == "polygon") {
        getPolygon(true);
        ctx.stroke();
    }
}

function updateRubberbandOnMove(loc) {
    updateRubberbandSizeData(loc);
    drawRubberbandShape(loc);
}

function addBrushPoint(x, y, mouseDown) {
    currentStroke["points"].push({
        "x": x,
        "y": y,
        "mDown": mouseDown
    });
}

function drawCur() {
    for (let j = 1; j < currentStroke["points"].length; ++j) {
        ctx.beginPath();

        if (currentStroke["points"][j]["mDown"]) {
            ctx.moveTo(currentStroke["points"][j - 1]["x"], currentStroke["points"][j - 1]["y"]);
        } else {
            ctx.moveTo(currentStroke["points"][j]["x"] - 1, currentStroke["points"][j]["y"]);
        }

        ctx.lineTo(currentStroke["points"][j]["x"], currentStroke["points"][j]["y"]);
        ctx.closePath();
        ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allPoints != undefined) {
        for (let i = 0; i < allPoints.length; ++i) {
            if (allPoints[i]["shape"] == "brush") {
                for (let j = 1; j < allPoints[i]["points"].length; ++j) {
                    ctx.beginPath();

                    if (allPoints[i]["points"][j]["mDown"]) {
                        ctx.moveTo(allPoints[i]["points"][j - 1]["x"], allPoints[i]["points"][j - 1]["y"]);
                    } else {
                        ctx.moveTo(allPoints[i]["points"][j]["x"] - 1, allPoints[i]["points"][j]["y"]);
                    }

                    ctx.lineTo(allPoints[i]["points"][j]["x"], allPoints[i]["points"][j]["y"]);
                    ctx.closePath();
                    ctx.stroke();
                }
            } else if (allPoints[i]["shape"] == "line") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0], allPoints[i]["points"][1]);
                ctx.lineTo(allPoints[i]["points"][2], allPoints[i]["points"][3]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "rectangle") {
                ctx.strokeRect(allPoints[i]["points"][0], allPoints[i]["points"][1], allPoints[i]["points"][2], allPoints[i]["points"][3]);
            } else if (allPoints[i]["shape"] == "circle") {
                ctx.beginPath();
                ctx.arc(allPoints[i]["points"][0], allPoints[i]["points"][1], allPoints[i]["points"][2], allPoints[i]["points"][3],allPoints[i]["points"][4]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "ellipse") {
                ctx.beginPath();
                ctx.ellipse(allPoints[i]["points"][0], allPoints[i]["points"][1], allPoints[i]["points"][2], allPoints[i]["points"][3], allPoints[i]["points"][4], allPoints[i]["points"][5], allPoints[i]["points"][6]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "polygon") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0], allPoints[i]["points"][1]);
                for (let j = 2; j < allPoints[i]["points"].length; j+=2) {
                    ctx.lineTo(allPoints[i]["points"][j], allPoints[i]["points"][j+1]);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        }
}

function reactToMouseDown(e) {
    canvas.style.cursor = "crosshair";
    loc = getMousePosition(e.clientX, e.clientY);
    saveCanvasImage();
    mousedown.x = loc.x;
    mousedown.y = loc.y;
    dragging = true;

    if (currentTool === "brush") {
        usingBrush = true;
        currentStroke = {
            "shape": "brush",
            "strokeWeight": 2,
            "colour": {
                "r": 255,
                "g": 255,
                "b": 255,
                "a": 0
            },
            "points": []
        };
        addBrushPoint(loc.x, loc.y, false);
    }
    
};

function reactToMouseMove(e) {
    canvas.style.cursor = "crosshair";
    loc = getMousePosition(e.clientX, e.clientY);

    if (currentTool == "brush" && dragging && usingBrush) {
        if (loc.x > 0 && loc.x < canvasWidth && loc.y > 0 && loc.y < canvasHeight) {
            addBrushPoint(loc.x, loc.y, true);
        }
        redrawCanvasImage();
        drawCur();
    } else {
        if (dragging) {
            redrawCanvasImage();
            updateRubberbandOnMove(loc);
        }
    }
};

function reactToMouseUp(e) {
    canvas.style.cursor = "default";
    loc = getMousePosition(e.clientX, e.clientY);
    redrawCanvasImage();
    updateRubberbandOnMove(loc);

    let points = []

    if (currentTool == "brush") {
        points = currentStroke["points"];
    } else if (currentTool == "line") {
        points = [mousedown.x, mousedown.y, loc.x, loc.y];
    } else if (currentTool == "rectangle") {
        points = [shapeBoundingBox.left, shapeBoundingBox.top, shapeBoundingBox.width, shapeBoundingBox.height];
    } else if (currentTool == "circle") {
        points = [mousedown.x, mousedown.y, shapeBoundingBox.width, 0, Math.PI * 2];
    } else if (currentTool == "ellipse") {
        points = [mousedown.x, mousedown.y, shapeBoundingBox.width / 2, shapeBoundingBox.height / 2, Math.PI / 4, 0, Math.PI * 2];
    } else if (currentTool == "polygon") {
        points = getPolygon(false);
    }
    dragging = false;
    usingBrush = false;

    ids.push(uuidv4());

    allPoints.push({
        "shape": currentTool,
        "id": ids[ids.length - 1],
        "strokeWeight": 2,
        "colour": {
            "r": 255,
            "g": 255,
            "b": 255,
            "a": 0
        },
        "points": points
    });

    //push();
}

function saveImage() {
    var imageFile = document.getElementById("img-file");
    imageFile.setAttribute("download", "whiteboard.png");
    imageFile.setAttribute("href", canvas.toDataURL());
}

function openImage() {
    let img = new Image();
    img.onload = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    }
    img.src = "whiteboard.png";
}

function pop() {
    for (let i = allPoints.length - 1; i >= 0; --i) {
        if (allPoints[i]["id"] == ids[ids.length - 1]) {
            board.update({
                strokes: firebase.firestore.FieldValue.arrayRemove(allPoints[i])
            });
            break;
        }
    }
}

function push() {
    for (let i = allPoints.length - 1; i >= 0; --i) {
        if (allPoints[i]["id"] == ids[ids.length - 1]) {
            board.update({
                strokes: firebase.firestore.FieldValue.arrayUnion(allPoints[i])
            });
            break;
        }
    }
}

function undo() {
<<<<<<< HEAD
    if (ids.length > 0) {
        pop();
        ids.pop();
=======
    if (brushPoints.length > 0) {
        //pop();
        brushPoints.pop();
>>>>>>> alex1
        draw();
    }
}

function clearStrokes() {
    board.update({
        strokes: []
    });
}

document.addEventListener("DOMContentLoaded", event => {
    app = firebase.app();
    db = firebase.firestore();
    board = db.collection("boards").doc("w9hQ0PWMGTXTSMh4iJMK");

    board.onSnapshot(doc => {
        const data = doc.data();
        allPoints = data["strokes"];
        draw();
    })
});

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            document.write(`Hello ${user.displayName}`);
            console.log(user);
        })
        .catch(console.log);
}

function openNav() {
    console.log("lel");
    document.getElementById("mySidenav").style.width = "50px";
}

function closeNav() {
    document.getElementById("mySidenav").style.width = "0";
}