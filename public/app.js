let canvas;
let ctx;

var auth = firebase.auth();
var storageRef = firebase.storage().ref();

let loadedImgs = {};

let paletteCanvas;
let paletteCtx;

let savedImageData;

let dragging = false;
let strokeColor = "#000000";
let fillColor = "#000000";
let lineWidth = 2;
let polygonSides = 6;

let currentTool = "brush";
let canvasWidth = 1000;
let canvasHeight = 1000;

let usingBrush = false;
let currentStroke = {};

let imgName = "";
let imgObj;

let app;
let db;
let board;
let user = null;
let allPoints = [];
let ids = [];

let output = document.getElementById("weightVal");
output.innerHTML = 1;
let opacityOutput = document.getElementById("opacityVal");
opacityOutput.innerHTML = 255;
let zoom = 1;
let oldXOffset = 0;
let oldYOffset = 0;
let xOffset = 0;
let yOffset = 0;

let typingX = 0;
let typingY = 0;
let typingMessage = "";

let pStrokeColor = "";
let erasing = false;

let allMessages = []
let currentMessages = []

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
    canvas.addEventListener("wheel", reactToZoom);
    document.addEventListener("keypress", reactKeyPressed);
    document.addEventListener("keydown", reactKeyDown);

    ctx.font = "30px Comic Sans MS";

    rainbow();

    document.getElementById('file').addEventListener('change', handleFileSelect, false);
    document.getElementById('file').disabled = true;

    auth.onAuthStateChanged(function (user) {
        if (user) {
            console.log('Anonymous user signed-in.', user);
            document.getElementById('file').disabled = false;
        } else {
            console.log('There was no anonymous session. Creating a new anonymous user.');
            // Sign the user in anonymously since accessing Storage requires the user to be authorized.
            auth.signInAnonymously().catch(function (error) {
                if (error.code === 'auth/operation-not-allowed') {
                    window.alert('Anonymous Sign-in failed. Please make sure that you have enabled anonymous ' +
                        'sign-in on your Firebase project.');
                }
            });
        }
    });
}

function drawPalette() {
    //paletteCtx.clearRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    paletteCtx.globalCompositeOperation = "source-over";
    paletteCtx.fillStyle = strokeColor;
    paletteCtx.fillRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    paletteCtx.globalCompositeOperation = "destination-in";
    paletteCtx.drawImage(paletteImg, 0, 0, paletteCanvas.width, paletteCanvas.height);
}

function changeTool(toolClicked, openForms = true) {
    document.getElementById("save").className = "";
    document.getElementById("brush").className = "";
    document.getElementById("line").className = "";
    document.getElementById("rectangle").className = "";
    document.getElementById("circle").className = "";
    document.getElementById("ellipse").className = "";
    document.getElementById("polygon").className = "";
    document.getElementById("hand").className = "";
    document.getElementById("rainbow").className = "";
    document.getElementById("text").className = "";
    document.getElementById("eraser").className = "";
    document.getElementById("image").className = "";
    document.getElementById(toolClicked).className = "selected";

    if (currentTool == "text" && typingMessage != "") {
        ids.push(uuidv4());

        allPoints.push({
            "shape": currentTool,
            "id": ids[ids.length - 1],
            "strokeWeight": lineWidth,
            "colour": strokeColor,
            "points": [(typingX - xOffset) / zoom, (typingY - yOffset) / zoom],
            "text": typingMessage
        });

        push();
    }

    if (erasing && toolClicked != "eraser") {
        erasing = false;
        strokeColor = pStrokeColor;
    }

    currentTool = toolClicked;

    canvas.style.cursor = "crosshair";
    if (currentTool == "hand") {
        canvas.style.cursor = "grab";
    } else if (currentTool == "brush" && openForms) {
        openStrokeForm();
    } else if (currentTool == "rainbow") {
        strokeColor = "rainbow";
        currentTool = "brush";
    } else if (currentTool == "text") {
        canvas.style.cursor = "text";
        typingMessage = "";
    } else if (currentTool == "eraser") {
        currentTool = "brush";
        erasing = true;
        pStrokeColor = strokeColor;
        strokeColor = "#ffffff";
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
        points = [(polygonPoints[0].x - xOffset) / zoom, (polygonPoints[0].y - yOffset) / zoom];
        for (let i = 1; i < polygonSides; i++) {
            points.push((polygonPoints[i].x - xOffset) / zoom, (polygonPoints[i].y - yOffset) / zoom)
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

function setFillStyle(strokeColor) {

    if (strokeColor == "rainbow") {
        ctx.fillStyle = rainbowGradient;
    } else {
        ctx.fillStyle = strokeColor;
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
    } else if (currentTool == "text") {
        setFillStyle(strokeColor);
        ctx.fillText(typingMessage, typingX, typingY);
    } else if (currentTool == "image") {
        ctx.drawImage(imgObj, shapeBoundingBox.left, shapeBoundingBox.top, shapeBoundingBox.width, shapeBoundingBox.height);
    }
}

function updateRubberbandOnMove(loc) {
    updateRubberbandSizeData(loc);
    drawRubberbandShape(loc);
}

function addBrushPoint(x, y, mouseDown) {
    currentStroke["points"].push({
        "x": (x - xOffset) / zoom,
        "y": (y - yOffset) / zoom,
        "mDown": mouseDown
    });
}

function drawCur() {
    setStrokeStyle(currentStroke["colour"]);
    ctx.lineWidth = currentStroke["strokeWeight"];
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let j = 1; j < currentStroke["points"].length; ++j) {
        if (j == 1) {
            ctx.moveTo(currentStroke["points"][j - 1]["x"] * zoom + xOffset, currentStroke["points"][j - 1]["y"] * zoom + yOffset);
        }
        ctx.lineTo(currentStroke["points"][j]["x"] * zoom + xOffset, currentStroke["points"][j]["y"] * zoom + yOffset);
    }
    ctx.stroke();
    //ctx.closePath();
    ctx.lineJoin = "miter";
}

function draw() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#c4c4c4";
    let gridSize = 50;
    while (gridSize * zoom < 30) {
        gridSize = gridSize * 10;
    }
    while (gridSize * zoom > 500) {
        gridSize = gridSize / 10;
    }
    for (let i = xOffset % (gridSize * zoom); i < canvas.width; i += gridSize * zoom) {
        for (let j = yOffset % (gridSize * zoom); j < canvas.height; j += gridSize * zoom) {
            ctx.fillRect(i - 1, j - 1, 3, 3);
        }
    }

    if (allPoints != undefined) {
        for (let i = 0; i < allPoints.length; ++i) {
            setStrokeStyle(allPoints[i]["colour"]);
            ctx.lineWidth = allPoints[i]["strokeWeight"] * zoom;
            if (allPoints[i]["shape"] == "brush") {
                ctx.beginPath();
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                for (let j = 1; j < allPoints[i]["points"].length; ++j) {
                    if (j == 1) {
                        ctx.moveTo(allPoints[i]["points"][j - 1]["x"] * zoom + xOffset, allPoints[i]["points"][j - 1]["y"] * zoom + yOffset);
                    }
                    ctx.lineTo(allPoints[i]["points"][j]["x"] * zoom + xOffset, allPoints[i]["points"][j]["y"] * zoom + yOffset);
                }
                //ctx.closePath();
                ctx.stroke();
                ctx.lineJoin = "miter";
            } else if (allPoints[i]["shape"] == "line") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset);
                ctx.lineTo(allPoints[i]["points"][2] * zoom + xOffset, allPoints[i]["points"][3] * zoom + yOffset);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "rectangle") {
                ctx.strokeRect(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset, allPoints[i]["points"][2] * zoom, allPoints[i]["points"][3] * zoom);
            } else if (allPoints[i]["shape"] == "circle") {
                ctx.beginPath();
                ctx.arc(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset, allPoints[i]["points"][2] * zoom, allPoints[i]["points"][3], allPoints[i]["points"][4]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "ellipse") {
                ctx.beginPath();
                ctx.ellipse(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset, allPoints[i]["points"][2] * zoom, allPoints[i]["points"][3] * zoom, allPoints[i]["points"][4], allPoints[i]["points"][5], allPoints[i]["points"][6]);
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "polygon") {
                ctx.beginPath();
                ctx.moveTo(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset);
                for (let j = 2; j < allPoints[i]["points"].length; j += 2) {
                    ctx.lineTo(allPoints[i]["points"][j] * zoom + xOffset, allPoints[i]["points"][j + 1] * zoom + yOffset);
                }
                ctx.closePath();
                ctx.stroke();
            } else if (allPoints[i]["shape"] == "text") {
                setFillStyle(allPoints[i]["colour"]);
                ctx.fillText(allPoints[i]["text"], allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset);
            } else if (allPoints[i]["shape"] == "image") {
                if (loadedImgs[allPoints[i]["text"]] && loadedImgs[allPoints[i]["text"]].complete) {
                    ctx.drawImage(loadedImgs[allPoints[i]["text"]], allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset, allPoints[i]["points"][2] * zoom, allPoints[i]["points"][3] * zoom);
                } else {
                    ctx.fillStyle = "#AAAAAA"
                    ctx.fillRect(allPoints[i]["points"][0] * zoom + xOffset, allPoints[i]["points"][1] * zoom + yOffset, allPoints[i]["points"][2] * zoom, allPoints[i]["points"][3] * zoom);
                    var imgRef = storageRef.child('images/' + allPoints[i]["text"]);

                    // Get the download URL
                    imgRef.getDownloadURL().then(function (url) {
                        loadedImgs[allPoints[i]["text"]] = new Image;
                        loadedImgs[allPoints[i]["text"]].src = url;
                        draw();
                    })
                }
            }
        }
    }
}

let middleMouseDown = false;

function reactToMouseDown(e) {
    canvas.style.cursor = "crosshair";
    if (currentTool == "hand" || e.button == 1) {
        middleMouseDown = true;
        canvas.style.cursor = "grabbing";
    } else if (currentTool == "text") {
        canvas.style.cursor = "text";
    }
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
    //canvas.style.cursor = "crosshair";
    loc = getMousePosition(e.clientX, e.clientY);

    if (middleMouseDown) {
        xOffset = loc.x - mousedown.x + oldXOffset;
        yOffset = loc.y - mousedown.y + oldYOffset;
        draw();
    } else if (currentTool == "brush" && dragging && usingBrush) {
        if (loc.x > 0 && loc.x < canvasWidth && loc.y > 0 && loc.y < canvasHeight) {
            addBrushPoint(loc.x, loc.y, true);
        }
        draw();
        drawCur();
    } else {
        if (dragging) {
            draw();
            updateRubberbandOnMove(loc);
        }
    }
};

function reactKeyPressed(e) {
    if (currentTool == "text") {
        if (e.keyCode >= 32 && e.keyCode <= 126) {
            typingMessage += e.key;

            draw();

            setFillStyle(strokeColor);
            ctx.fillText(typingMessage, typingX, typingY);
        }
    } else {
        if (e.key == 'h') {
            changeTool('hand');
        } else if (e.key == 'w') {
            clearStrokes();
        } else if (e.key == 'z') {
            undo();
        } else if (e.key == 'b') {
            changeTool('brush', false);
        } else if (e.key == 'l') {
            changeTool('line');
        } else if (e.key == 'r') {
            changeTool('rectangle');
        } else if (e.key == 'c') {
            changeTool('circle');
        } else if (e.key == 'e') {
            changeTool('eraser');
        } else if (e.key == 'x') {
            changeTool('polygon');
        } else if (e.key == 'g') {
            changeTool('rainbow');
        } else if (e.key == 't') {
            changeTool('text');
        }
    }
}

function reactKeyDown(e) {
    if (currentTool == "text") {
        if (e.keyCode == 8 && typingMessage.length > 0) {
            typingMessage = typingMessage.substring(0, typingMessage.length - 1);

            draw();

            setFillStyle(strokeColor);
            ctx.fillText(typingMessage, typingX, typingY);
        }
    }
}

function reactToZoom(e) {
    event.preventDefault();

    let oldZoom = zoom;
    if (e.deltaY > 0) {
        zoom *= 9 / 10;
    } else {
        zoom /= 9 / 10;
    }

    xOffset = e.clientX - zoom * (e.clientX - xOffset) / oldZoom;
    yOffset = e.clientY - zoom * (e.clientY - yOffset) / oldZoom;

    ctx.font = `${((Math.floor((lineWidth - 2) * 2 / 10) + 1)*4 + 10)*zoom}px Comic Sans MS`;

    draw();
}

function home() {
    oldXOffset = 0;
    oldYOffset = 0;
    xOffset = 0;
    yOffset = 0;
    zoom = 1;
    draw();
}

function reactToMouseUp(e) {

    middleMouseDown = false;

    //canvas.style.cursor = "default";
    if (currentTool == "hand") {
        canvas.style.cursor = "grab";
    }
    if (e.button == 1) {
        canvas.style.cursor = "crosshair";
    }
    loc = getMousePosition(e.clientX, e.clientY);
    draw()
    updateRubberbandOnMove(loc);

    let points = []

    dragging = false;
    usingBrush = false;

    if (currentTool == "text" && typingMessage != "") {
        ids.push(uuidv4());

        allPoints.push({
            "shape": currentTool,
            "id": ids[ids.length - 1],
            "strokeWeight": lineWidth,
            "colour": strokeColor,
            "points": [(typingX - xOffset) / zoom, (typingY - yOffset) / zoom],
            "text": typingMessage
        });

        push();

        typingMessage = "";
    }

    if (currentTool == "image") {
        points = [(shapeBoundingBox.left - xOffset) / zoom, (shapeBoundingBox.top - yOffset) / zoom, shapeBoundingBox.width / zoom, shapeBoundingBox.height / zoom];
        ids.push(uuidv4());

        allPoints.push({
            "shape": currentTool,
            "id": ids[ids.length - 1],
            "strokeWeight": lineWidth / zoom,
            "colour": strokeColor,
            "points": points,
            "text": imgName
        });

        push();
        changeTool("brush", false);
        return;
    }
    if (currentTool == "brush") {
        points = currentStroke["points"];
    } else if (currentTool == "line") {
        points = [(mousedown.x - xOffset) / zoom, (mousedown.y - yOffset) / zoom, (loc.x - xOffset) / zoom, (loc.y - yOffset) / zoom];
    } else if (currentTool == "rectangle") {
        points = [(shapeBoundingBox.left - xOffset) / zoom, (shapeBoundingBox.top - yOffset) / zoom, shapeBoundingBox.width / zoom, shapeBoundingBox.height / zoom];
    } else if (currentTool == "circle") {
        points = [(mousedown.x - xOffset) / zoom, (mousedown.y - yOffset) / zoom, shapeBoundingBox.width / zoom, 0, Math.PI * 2];
    } else if (currentTool == "ellipse") {
        points = [(mousedown.x - xOffset) / zoom, (mousedown.y - yOffset) / zoom, (shapeBoundingBox.width / 2) / zoom, (shapeBoundingBox.height / 2) / zoom, Math.PI / 4, 0, Math.PI * 2];
    } else if (currentTool == "polygon") {
        points = getPolygon(false);
    } else if (currentTool == "text") {
        typingX = loc.x;
        typingY = loc.y;
    }

    if (currentTool != "hand" && currentTool != "text" && e.button != 1) {
        ids.push(uuidv4());

        allPoints.push({
            "shape": currentTool,
            "id": ids[ids.length - 1],
            "strokeWeight": lineWidth / zoom,
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
    imageFile.click();
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
        strokes: [],
        messages: []
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
        allMessages = data["messages"];
        draw();
        updateMessages();
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

function changeColor() {
    let temp = strokeColor.substring(7);
    strokeColor = document.getElementById("colorChoice").value + temp;
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

    rainbowGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

    let stops = 36;
    let cycles = 3;
    for (let i = 0; i < 36; i++) {
        rainbowGradient.addColorStop(`${i/stops}`, hsltorgb((i / stops * cycles) % 1, 1, 0.5));
    }
}

function openStrokeForm() {
    document.getElementById("strokeForm").style.display = "block";
}

function closeStrokeForm() {
    document.getElementById("strokeForm").style.display = "none";
}

function changeStroke() {
    lineWidth = Math.floor(document.getElementById("strokeChoice").value / 2) + 2;
    let val = Math.floor((lineWidth - 2) * 2 / 10) + 1;
    output.innerHTML = val;
    ctx.font = `${val*4 + 10}px Comic Sans MS`;
}

// Get the modal
let modal = document.getElementById("myModal");

// Get the button that opens the modal
let btn = document.getElementById("myBtn");

// Get the <span> element that closes the modal
let span = document.getElementsByClassName("close")[0];

// When the user clicks the button, open the modal 
function openModal() {
    modal.style.display = "block";
    document.getElementById('linkbox').innerHTML = "";
    document.getElementById('file').value = "";
    document.getElementById('insert-image').disabled = true;
}

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
    modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function openOpacityForm() {
    document.getElementById("opacityForm").style.display = "block";
}

function closeOpacityForm() {
    document.getElementById("opacityForm").style.display = "none";
}

function changeOpacity() {
    strokeColor = strokeColor.substring(0, 7);
    strokeColor += opacityToHex(Math.floor(document.getElementById("opacityChoice").value / 100 * 255));
    console.log(strokeColor);
    let val = Math.floor(document.getElementById("opacityChoice").value / 100 * 255);
    opacityOutput.innerHTML = val;
}

function opacityToHex(opacity) {
    if (opacity < 16) {
        return `0${opacity.toString(16)}`;
    }
    return opacity.toString(16);
}

function openChat() {
    document.getElementById("chat").style.display = "block";
    document.getElementById("open-button").style.display = "none";
  }
function closeChat() {
    document.getElementById("chat").style.display = "none";
    document.getElementById("open-button").style.display = "block";
  }
function googleLogin() {
    // const provider = new firebase.auth.GoogleAuthProvider();
    // firebase.auth().signInWithPopup(provider)
    // .then(result => {
    //     user = result.user;
    //     document.getElementById("login-button").style.display = "none";
    //     document.getElementById("open-button").style.display = "block";
    // })
    // .catch(console.log);

    document.getElementById("login-button").style.display = "none";
    document.getElementById("open-button").style.display = "block";

    user = {
        "displayName": "ethan"
    }
}

function pushMessage() {
    let messageBox = document.getElementById("messageBox");

    board.update({
        messages: firebase.firestore.FieldValue.arrayUnion({
            "user": user.displayName,
            "content": messageBox.value,
            "id": uuidv4()
        })
    });

    messageBox.value = "";
}

function updateMessages() {
    let chatBox = document.getElementById("chatBox");
    
    for (let i = currentMessages.length; i < allMessages.length; ++i) {
        let item = document.createElement('li');
        item.appendChild(document.createTextNode(`${allMessages[i]["user"]}: ${allMessages[i]["content"]}`));
        chatBox.appendChild(item);
    }

    currentMessages = allMessages;
}

function openPaletteForms() {
    openColorForm()
    openOpacityForm();
}

function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    var file = evt.target.files[0];

    console.log(file)

    var metadata = {
        'contentType': file.type
    };

    // Push to child path.
    // [START oncomplete]

    imgName = uuidv4() + file.name.split('.').pop();;

    storageRef.child('images/' + imgName).put(file, metadata).then(function (snapshot) {
        console.log('Uploaded', snapshot.totalBytes, 'bytes.');
        console.log('File metadata:', snapshot.metadata);
        // Let's get a download URL for the file.
        snapshot.ref.getDownloadURL().then(function (url) {
            console.log('File available at', url);
            // [START_EXCLUDE]
            document.getElementById('linkbox').innerHTML = `<img id="linkboximg" src="${url}"></img>`;

            document.getElementById('linkboximg').onload = () => {
                document.getElementById('insert-image').disabled = false;
            };
            // [END_EXCLUDE]
        });
    }).catch(function (error) {
        // [START onfailure]
        console.error('Upload failed:', error);
        // [END onfailure]
    });
    // [END oncomplete]
}

function addImg() {
    modal.style.display = "none";
    changeTool("image");

    imgObj = document.getElementById('linkboximg');
}