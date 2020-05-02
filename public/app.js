var c = document.getElementById("myCanvas");
var ctx = c.getContext("2d");

ctx.moveTo(0, 0);
ctx.lineTo(200, 100);
ctx.stroke();

ctx.beginPath();
ctx.arc(95, 50, 40, 0, 2 * Math.PI);
ctx.stroke();

document.addEventListener("DOMContentLoaded", event => {
    const app = firebase.app();
    console.log(app);
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