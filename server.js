const express = require("express");
const app = express();        
const portNumber = 5000;
const OpenAI = require("openai");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("./templates"));
app.set("views", "./templates");
app.set("view engine", "ejs");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, './.env') }); 
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

const openai = new OpenAI({
    apiKey: process.env.API_KEY
});

main()
var correctAnswer = "";
var currUser = "";
var userScore = 0;
var bestScore = 0;

async function main() { 
    try {
        await client.connect();
    } catch (e) {
        console.error(e);
    }
}

app.get("/", (request, response) => {
    response.render("login", {invalid: ""})
});


app.post("/createAccount", async (request, response) => {
    var user = request.body.user;
    var pass = request.body.password;

    var filter = {user_name: user};

    var data = {
        user_name: user,
        password: pass 
    };

    var result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).findOne(filter);
    if(result){
        response.send("Username has been taken, use another one. Use the browser back arrow to go back.");
    } else{
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(data);
        response.redirect("/")
    }
});

app.get("/register", (request, response) => {
    response.render("register")
});

app.get("/forgot", (request, response) => {
    response.render("forgot")
});

app.post("/resetPassword", async (request, response) => {
    var filter = {user_name: request.body.user};
    var result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).findOne(filter);

    if(result) {
        var newFilter = {user_name: request.body.user}
        var update = {$set: {password: request.body.password}};
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).updateOne(newFilter, update);
        response.redirect("/");
    } else {
        response.send(`There is no account associated with the specified username: ${request.body.user}`)
    }
});

app.get("/start", async (request, response) => {
    response.render("start")
})

app.post("/start", async (request, response) => {
    var user = {user_name: request.body.user, password: request.body.password};
    var result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).findOne(user);

    if(result){
        response.render("start")
    }else{
        response.render("invalid")
    }
});

app.get("/trivia", async (request, response) => {
    const chat = await openai.chat.completions.create({
        messages: [
          {role: "system", content: "You are a helpful assistant that provides trivia questions."},
          {role: "assistant", content: "Random College-Level Trivia"},
          {role: "user", content: "Please ask a multiple-choice trivia question that you have not previously asked please with exactly 4 distinct options regarding an arbitrary trivia topic with the exact following format (brackets included please):" +
                                  "\n[Topic: <Topic Name>]" +
                                  "\n[Question: <Question Name>]" +
                                  "\n[Option1: <Answer Choice 1>]" +
                                  "\n[Option2 <Answer Choice 2>]" + 
                                  "\n[Option3: <Answer Choice 3>]" +
                                  "\n[Option4 <Answer Choice 4>]" +  
                                  "\n[CorrectAnswer: <Correct Answer Choice>]"},
        ],
        model: "gpt-3.5-turbo",
      });
    
    var content = chat.choices[0].message.content;
    var topic = content.split("Topic:")[1].split("]")[0].trim();
    var question = content.split("Question:")[1].split("]")[0].trim();
    var options = [content.split("Option1:")[1].split("]")[0].trim(), content.split("Option2:")[1].split("]")[0].trim(), 
                   content.split("Option3:")[1].split("]")[0].trim(), content.split("Option4:")[1].split("]")[0].trim()];
    correctAnswer = content.split("CorrectAnswer:")[1].split("]")[0].trim();

    var multipleChoice = `<input type='radio' name="option" value="${options[0]}"> ${options[0]} <br> 
                          <input type='radio' name="option" value="${options[1]}"> ${options[1]} <br> 
                          <input type='radio' name="option" value="${options[2]}"> ${options[2]} <br> 
                          <input type='radio' name="option" value="${options[3]}"> ${options[3]} <br><br>`

    var data = {
        topic: topic,
        best_score: bestScore,
        score: userScore,
        question: question,
        options: multipleChoice,
    };

    response.render("trivia", data)
});

app.post("/answer", (request, response) => {
    var option = request.body.option;
    var ans, button;

    if(option === correctAnswer) {
        userScore++;
        bestScore = Math.max(bestScore, userScore);
        ans = "Your Answer is Correct! Move on to the next question!";    
        button = "<input type='submit' id='submission' value='Next Question'>";
    } else {
        userScore = 0;
        ans = `Your Answer is Incorrect! The correct answer is ${correctAnswer}! Click the reset link to try again!`;    
        button = "<a href='/start'>Reset Trivia</a>";
    }

    var data = {
        label: ans,
        best_score: bestScore,
        score: userScore,
        button: button,
    }

    response.render("answer", data)
});

app.listen(portNumber, () => {
    console.log(`Web server started and running at http://localhost:${portNumber}`);
    process.stdin.setEncoding('utf8');
});

client.close();
