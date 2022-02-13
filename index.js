const firebaseConfig = import('./firebase.config');
const Block = import('./block.class');

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const grid = document.querySelector('.grid');
const scoreDisplay = document.querySelector('#score');
const levelDisplay = document.querySelector('#level');
const bodyScoreBoard = document.querySelector('#scoreboard-body');

const userName = document.querySelector('#userName');
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
    if (userName.value.length > 2 && userName.value.length < 6) {
        // Get a database reference to our posts
        var ref = db.ref();
        // Attach an asynchronous callback to read the data at our posts reference
        ref.once('value', function (snapshot) {
            if (!snapshot.hasChild(userName.value)) {
                timerId = setInterval(moveBall, 20 / level);
                var ref = db.ref();
                ref.child(userName.value).child('level').set(1);
                ref.child(userName.value).child('score').set(0);
                userName.setAttribute('disabled', true);
                buttonStart.setAttribute('disabled', true);
            } else {
                alert('this username has already been used')
            }
        });
    } else {
        alert('User name must be 3 to 5 characters')
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
            var ref = db.ref();
            ref.child(userName.value).child('score').set(score);

            scoreDisplay.innerHTML = score;

            // check win
            if (blocks.length === 0) {
                level++;
                var ref = db.ref();
                ref.child(userName.value).child('level').set(level);
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

    // Get a database reference to our posts
    var ref = db.ref();

    // Attach an asynchronous callback to read the data at our posts reference
    ref.on("value", function (snapshot) {
        bodyScoreBoard.innerHTML = '';
        let sorted = {};
        if (snapshot.val() !== null) {

            Object
                .keys(snapshot.val()).sort(function (a, b) {
                    return snapshot.val()[b].score - snapshot.val()[a].score;
                })
                .forEach(function (key) {
                    sorted[key] = snapshot.val()[key];
                });
            for (const [userkey, uservalue] of Object.entries(sorted)) {
                const row = document.createElement('tr');
                const tdUser = document.createElement('td');
                tdUser.innerHTML = userkey;
                row.appendChild(tdUser);
                for (const [key, value] of Object.entries(uservalue)) {
                    const td = document.createElement('td');
                    td.innerHTML = value;
                    row.appendChild(td);
                }
                bodyScoreBoard.appendChild(row);
            }

        }
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });

}
