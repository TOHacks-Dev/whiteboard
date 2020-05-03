let canvas;
let ctx;

let paletteCanvas;
let paletteCtx;

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


let oldXOffset = 0;
let oldYOffset = 0;
let xOffset = 0;
let yOffset = 0;

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
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

var paletteImg = new Image;

document.addEventListener("DOMContentLoaded", setupCanvas);

function setupCanvas() {
    canvas = document.getElementById("my-canvas");
    ctx = canvas.getContext("2d");
    paletteCanvas = document.getElementById("palette-canvas");
    paletteCanvas.height = paletteCanvas.width;
    paletteCtx = paletteCanvas.getContext("2d");
    paletteImg.onload = drawPalette;
    paletteImg.src = "images/palette.png";

    setStrokeStyle(strokeColor);
    ctx.lineWidth = lineWidth;
    let canvasSizeData = canvas.getBoundingClientRect();
    canvas.width = canvasWidth = window.innerWidth;
    canvas.height = canvasHeight = window.innerHeight;
    canvas.addEventListener("mousedown", reactToMouseDown);
    canvas.addEventListener("mousemove", reactToMouseMove);
    canvas.addEventListener("mouseup", reactToMouseUp);

    rainbow();
}

function drawPalette() {
    //paletteCtx.clearRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    paletteCtx.globalCompositeOperation = "source-over";
    paletteCtx.fillStyle = strokeColor;
    paletteCtx.fillRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    paletteCtx.globalCompositeOperation = "destination-in";
    paletteCtx.drawImage(paletteImg, 0, 0, paletteCanvas.width, paletteCanvas.height);
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
    document.getElementById("hand").className = "";
    document.getElementById("rainbow").className = "";
    document.getElementById(toolClicked).className = "selected";
    currentTool = toolClicked;

    if (currentTool == "rainbow") {
        strokeColor = "rainbow";
        currentTool = "brush";
    }
}

function getMousePosition(x, y) {
    let canvasSizeData = canvas.getBoundingClientRect();
    return {
        x: (x - canvasSizeData.left) * (canvas.width / canvasSizeData.width),
        y: (y - canvasSizeData.top) * (canvas.height / canvasSizeData.height)
    };
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
        points = [polygonPoints[0].x - xOffset, polygonPoints[0].y - yOffset];
        for (let i = 1; i < polygonSides; i++) {
            points.push(polygonPoints[i].x - xOffset, polygonPoints[i].y - yOffset)
        }
    }

    return points;
}

function setStrokeStyle(strokeColor) {

    if (strokeColor == "rainbow") {
        ctx.strokeStyle = rainbowGradient;
    } else {
        ctx.strokeStyle = strokeColor;
    }
}

function drawRubberbandShape(loc) {
    setStrokeStyle(strokeColor);
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
        "x": x - xOffset,
        "y": y - yOffset,
        "mDown": mouseDown
    });
}

function drawCur() {
    setStrokeStyle(currentStroke["colour"]);
    ctx.lineWidth = currentStroke["strokeWeight"];
    for (let j = 1; j < currentStroke["points"].length; ++j) {
        ctx.beginPath();

        if (currentStroke["points"][j]["mDown"]) {
            ctx.moveTo(currentStroke["points"][j - 1]["x"] + xOffset, currentStroke["points"][j - 1]["y"] + yOffset);
        } else {
            ctx.moveTo(currentStroke["points"][j]["x"] - 1 + xOffset, currentStroke["points"][j]["y"] + yOffset);
        }

        ctx.lineTo(currentStroke["points"][j]["x"] + xOffset, currentStroke["points"][j]["y"] + yOffset);
        ctx.closePath();
        ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allPoints != undefined) {
        for (let i = 0; i < allPoints.length; ++i) {
            setStrokeStyle(allPoints[i]["colour"]);
            ctx.lineWidth = allPoints[i]["strokeWeight"];
            if (allPoints[i]["shape"] == "brush") {
                for (let j = 1; j < allPoints[i]["points"].length; ++j) {
                    ctx.beginPath();

                    if (allPoints[i]["points"][j]["mDown"]) {
                        ctx.moveTo(allPoints[i]["points"][j - 1]["x"] + xOffset, allPoints[i]["points"][j - 1]["y"] + yOffset);
                    } else {
                        ctx.moveTo(allPoints[i]["points"][j]["x"] - 1 + xOffset, allPoints[i]["points"][j]["y"] + yOffset);
                    }

                    ctx.lineTo(allPoints[i]["points"][j]["x"] + xOffset, allPoints[i]["points"][j]["y"] + yOffset);
                    ctx.closePath();
                    ctx.stroke();
                }
            } else if (allPoints[i]["shape"] == "line") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0] + xOffset, allPoints[i]["points"][1] + yOffset);
                ctx.lineTo(allPoints[i]["points"][2] + xOffset, allPoints[i]["points"][3] + yOffset);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "rectangle") {
                ctx.strokeRect(allPoints[i]["points"][0] + xOffset, allPoints[i]["points"][1] + yOffset, allPoints[i]["points"][2], allPoints[i]["points"][3]);
            } else if (allPoints[i]["shape"] == "circle") {
                ctx.beginPath();
                ctx.arc(allPoints[i]["points"][0] + xOffset, allPoints[i]["points"][1] + yOffset, allPoints[i]["points"][2], allPoints[i]["points"][3], allPoints[i]["points"][4]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "ellipse") {
                ctx.beginPath();
                ctx.ellipse(allPoints[i]["points"][0] + xOffset, allPoints[i]["points"][1] + yOffset, allPoints[i]["points"][2], allPoints[i]["points"][3], allPoints[i]["points"][4], allPoints[i]["points"][5], allPoints[i]["points"][6]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "polygon") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0] + xOffset, allPoints[i]["points"][1] + yOffset);
                for (let j = 2; j < allPoints[i]["points"].length; j += 2) {
                    ctx.lineTo(allPoints[i]["points"][j] + xOffset, allPoints[i]["points"][j + 1] + yOffset);
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
    mousedown.x = loc.x;
    mousedown.y = loc.y;
    dragging = true;
    oldXOffset = xOffset;
    oldYOffset = yOffset;

    if (currentTool === "brush") {
        usingBrush = true;
        currentStroke = {
            "shape": "brush",
            "strokeWeight": lineWidth,
            "colour": strokeColor,
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
        draw();
        drawCur();
    } else if (currentTool == "hand" && dragging) {
        xOffset = loc.x - mousedown.x + oldXOffset;
        yOffset = loc.y - mousedown.y + oldYOffset;
        draw();
    } else {
        if (dragging) {
            draw();
            updateRubberbandOnMove(loc);
        }
    }
};

function reactToMouseUp(e) {
    canvas.style.cursor = "default";
    loc = getMousePosition(e.clientX, e.clientY);
    draw()
    updateRubberbandOnMove(loc);

    let points = []

    dragging = false;
    usingBrush = false;

    if (currentTool == "brush") {
        points = currentStroke["points"];
    } else if (currentTool == "line") {
        points = [mousedown.x - xOffset, mousedown.y - yOffset, loc.x - xOffset, loc.y - yOffset];
    } else if (currentTool == "rectangle") {
        points = [shapeBoundingBox.left - xOffset, shapeBoundingBox.top - yOffset, shapeBoundingBox.width, shapeBoundingBox.height];
    } else if (currentTool == "circle") {
        points = [mousedown.x - xOffset, mousedown.y - yOffset, shapeBoundingBox.width, 0, Math.PI * 2];
    } else if (currentTool == "ellipse") {
        points = [mousedown.x - xOffset, mousedown.y - yOffset, shapeBoundingBox.width / 2, shapeBoundingBox.height / 2, Math.PI / 4, 0, Math.PI * 2];
    } else if (currentTool == "polygon") {
        points = getPolygon(false);
    }

    if (currentTool != "hand") {
        ids.push(uuidv4());

        allPoints.push({
            "shape": currentTool,
            "id": ids[ids.length - 1],
            "strokeWeight": lineWidth,
            "colour": strokeColor,
            "points": points
        });

        push();
    }
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
    if (ids.length > 0) {
        pop();
        ids.pop();
        draw();
    }
}

function clearStrokes() {
    board.update({
        strokes: []
    });
}

document.addEventListener("DOMContentLoaded", event => {
    let path = window.location.pathname;
    path = path.substring(1);

    app = firebase.app();
    db = firebase.firestore();

    if (path == "") {
        db.collection("boards").add({
                strokes: []
            })
            .then(function (docRef) {
                window.location.href = window.location.origin + "/" + docRef.id;
            })
            .catch(function (e) {
                console.error("Error adding document: ", e);
            });
    } else {
        board = db.collection("boards").doc(path);

        board.get()
            .then(function (doc) {
                if (!doc.exists) {
                    db.collection("boards").add({
                            strokes: []
                        })
                        .then(function (docRef) {
                            window.location.href = window.location.origin + "/" + docRef.id;
                        })
                        .catch(function (e) {
                            console.error("Error adding document: ", e);
                        });
                }
            })
            .catch(function (e) {
                console.error("Error getting document: ", e);
            })
    }

    board.onSnapshot(doc => {
        const data = doc.data();
        allPoints = data["strokes"];
        draw();
    })
});

function openNav() {
    document.getElementById("mySidenav").style.width = "50px";
}

function closeNav() {
    document.getElementById("mySidenav").style.width = "0";
}

function openColorForm() {
    document.getElementById("colorForm").style.display = "block";
}

function closeColorForm() {
    document.getElementById("colorForm").style.display = "none";
}

function changeColor(col) {
    strokeColor = document.getElementById("colorChoice").value;
    drawPalette();
}

function hsltorgb(h, s, l) {
    var r, g, b;
    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = 255 * hue2rgb(p, q, h + 1 / 3);
        g = 255 * hue2rgb(p, q, h);
        b = 255 * hue2rgb(p, q, h - 1 / 3);
    }

    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

let h1 = 0,
    h2 = 0.1,
    h3 = 0.2;
let rainbowGradient;

function rainbow() {

    h1 += 0.001;
    if (h1 >= 1) {
        h1 -= 1;
    }
    h2 += 0.001;
    if (h2 >= 1) {
        h2 -= 1;
    }
    h3 += 0.001;
    if (h3 >= 1) {
        h3 -= 1;
    }

    var c3 = hsltorgb(h3, 0.75, 0.75);
    var c2 = hsltorgb(h2, 0.75, 0.75);
    var c1 = hsltorgb(h1, 0.75, 0.75);

    rainbowGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

    let stops = 36;
    let cycles = 3;
    for (let i = 0; i < 36; i++) {
        rainbowGradient.addColorStop(`${i/stops}`, hsltorgb((i/stops*cycles)%1, 0.95, 0.95));
    }

    /*rainbowGradient.addColorStop("0", c3);
    rainbowGradient.addColorStop("0.5", c2);
    rainbowGradient.addColorStop("1.0", c1);*/

    /*setTimeout(function () {
        rainbow();
    }, 10);*/
}