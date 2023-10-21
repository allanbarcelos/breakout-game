let ws = new WebSocket("ws://localhost:9900");

let userId;
const gameId = 'breakout';

ws.onopen = function () {
    ws.send(`/get-scores ${gameId}`);
    console.log("Connected to the WebSocket server.");
};

ws.onmessage = function (event) {
    const payload = JSON.parse(event.data)?.payload;
    
    if(payload === 'register' ){
        userId = JSON.parse(event.data)?.user_id;
    }

};

ws.onerror = function (error) {
    console.error("WebSocket Error: ", error);
}

function registerUser() {
    const username = document.getElementById('username').value;

    if (username.length !== 5) {
        alert('Username should be exactly 5 characters.');
        return;
    }

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(`/register ${username} ${gameId}`);
    }

    return true;
}

function getScores() {
    if (ws.readyState === WebSocket.OPEN) {
        console.log("ok");
        ws.send(`/get-scores ${gameId}`);
    }
}

function setScore() {
    // const userId = document.getElementById('userId').value;
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(`/set-score ${userId}`);
    }
}

// 

class Block {
    constructor(xAxis, yAxis) {
        this.bottomLeft = [xAxis, yAxis];
        this.bottomRight = [xAxis + blockWidth, yAxis];
        this.topLeft = [xAxis, yAxis + blockHeight];
        this.topRight = [xAxis + blockWidth, yAxis + blockHeight];
    }
}

// --

const grid = document.querySelector('.grid');
const scoreDisplay = document.querySelector('#score');
const levelDisplay = document.querySelector('#level');
const bodyScoreBoard = document.querySelector('#scoreboard-body');

const userName = document.querySelector('#username');
const buttonStart = document.querySelector('#buttonStart');
const restart = document.querySelector('#restart');

const blockWidth = 100;
const blockHeight = 20;
const boardWidth = 560;
const boardHeight = 300;

const colors = ['red', 'yellow', 'blue', 'green', 'pink', 'coral'];

const userStart = [230, 10];
let userCurrentPosition = userStart;

const ballStart = [270, 40];
let ballCurrentPosition = ballStart;

const ballDiameter = 20;
let timerId;
let xDirection = 2;
let yDirection = 2;
let score = 0;
let level = 1;

scoreDisplay.innerHTML = score;
levelDisplay.innerHTML = level;

// all blocks
let blocks;

function createBlocks() {
    blocks = [
        new Block(10, 270),
        new Block(120, 270),
        new Block(230, 270),
        new Block(340, 270),
        new Block(450, 270),

        new Block(10, 240),
        new Block(120, 240),
        new Block(230, 240),
        new Block(340, 240),
        new Block(450, 240),

        new Block(10, 210),
        new Block(120, 210),
        new Block(230, 210),
        new Block(340, 210),
        new Block(450, 210),
    ];
}


// draw all blocks
function addBlock() {
    createBlocks();
    for (let i = 0; i < blocks.length; i++) {
        const block = document.createElement('div');
        block.classList.add('block');
        block.style.left = blocks[i].bottomLeft[0] + 'px';
        block.style.bottom = blocks[i].bottomLeft[1] + 'px';
        block.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
        grid.appendChild(block);
    }
}

addBlock();

// add user
const user = document.createElement('div');
user.classList.add('user');
drawUser();
grid.appendChild(user);

// draw user
function drawUser() {
    user.style.left = userCurrentPosition[0] + 'px';
    user.style.bottom = userCurrentPosition[1] + 'px';
}

// draw ball
function drawBall() {
    ball.style.left = ballCurrentPosition[0] + 'px';
    ball.style.bottom = ballCurrentPosition[1] + 'px';
}

// move user
function moveUser(e) {
    switch (e.key) {
        case 'ArrowLeft':
            if (userCurrentPosition[0] > 0) {
                userCurrentPosition[0] -= 15;
                drawUser();
            }
            break;
        case 'ArrowRight':
            if (userCurrentPosition[0] < boardWidth - blockWidth) {
                userCurrentPosition[0] += 15;
                drawUser();
            }
            break;
    }
}

document.addEventListener('keydown', moveUser);

// add ball
const ball = document.createElement('div');
ball.classList.add('ball');
drawBall();
grid.appendChild(ball);

// move ball
function moveBall() {
    ballCurrentPosition[0] += xDirection;
    ballCurrentPosition[1] += yDirection;
    drawBall();
    checkForCollisions();
}

function start() {
    if(registerUser()){
        timerId = setInterval(moveBall, 20 / level);
        userName.setAttribute('disabled', true);
        buttonStart.setAttribute('disabled', true); 
    }

}

// check for collisions
function checkForCollisions() {

    // check for block collisions
    for (let i = 0; i < blocks.length; i++) {
        if (
            (ballCurrentPosition[0] > blocks[i].bottomLeft[0] && ballCurrentPosition[0] < blocks[i].bottomRight[0]) &&
            ((ballCurrentPosition[1] + ballDiameter) > blocks[i].bottomLeft[1] && ballCurrentPosition[1] < blocks[i].topLeft[1])
        ) {
            const allBlocks = Array.from(document.querySelectorAll('.block'));
            allBlocks[i].remove();//.classList.remove('block');
            blocks.splice(i, 1);
            changeDirection();
            score++;
            // var ref = db.ref();
            // ref.child(userName.value).child('score').set(score);
            setScore()
            scoreDisplay.innerHTML = score;

            // check win
            if (blocks.length === 0) {
                level++;
                // var ref = db.ref();
                // ref.child(userName.value).child('level').set(level);
                levelDisplay.innerHTML = level;
                clearInterval(timerId);
                timerId = setInterval(moveBall, 30 / level);
                addBlock();
                // scoreDisplay.innerHTML = 'YOU WIN';
                // clearInterval(timerId);
                // document.removeEventListener('keydown', moveUser);
            }
        }
    }

    if (
        ballCurrentPosition[0] >= (boardWidth - ballDiameter) ||
        ballCurrentPosition[1] >= (boardHeight - ballDiameter) ||
        ballCurrentPosition[0] <= 0
    ) {
        changeDirection();
    }

    // check for user collision
    if (
        (ballCurrentPosition[0] > userCurrentPosition[0] && ballCurrentPosition[0] < userCurrentPosition[0] + blockWidth) &&
        (ballCurrentPosition[1] > userCurrentPosition[1] && ballCurrentPosition[1] < userCurrentPosition[1] + blockHeight)
    ) {
        changeDirection();
    }

    // check for game over
    if (ballCurrentPosition[1] <= 0) {
        clearInterval(timerId);
        scoreDisplay.innerHTML = 'You lose';
        document.removeEventListener('keydown', moveUser);
        restart.classList.remove('hide');
    }

}

function changeDirection() {

    if (xDirection === 2 && yDirection === 2) {
        yDirection = -2;
        return;
    }

    if (xDirection === 2 && yDirection == -2) {
        xDirection = -2;
        return;
    }

    if (xDirection === -2 && yDirection === -2) {
        yDirection = 2;
        return;
    }

    if (xDirection === -2 && yDirection === 2) {
        xDirection = 2;
        return;
    }

}

getUsersScores();

function getUsersScores() {

    getScores();
    ws.onmessage = function (event) {
        const payload = JSON.parse(event.data)?.payload;
        console.log(event);
        if(payload === 'get-scores' || payload === 'set-score' ){

            bodyScoreBoard.innerHTML = '';
            if (JSON.parse(event.data)?.data.length > 0) {

                JSON.parse(event.data)?.data.forEach(({score, username}) => {
                    const row = document.createElement('tr');
                    const tdUser = document.createElement('td');
                    tdUser.innerHTML = username;
                    row.appendChild(tdUser);
                    // for (const [key, value] of Object.entries(uservalue)) {
                        const td = document.createElement('td');
                        td.innerHTML = score;
                        row.appendChild(td);
                    // }
                    bodyScoreBoard.appendChild(row);
                });

            }


        }

    };

}
