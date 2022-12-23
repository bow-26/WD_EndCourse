const express = require("express");
const app = express();
var csrf = require("tiny-csrf");
const path = require("path");
const { Todo } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_charactes_long", ["PUT", "POST", "DELETE"]));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");

app.get("/", async function (req, res) {
  try {
    const overdue = await Todo.overdue();
    const dueToday = await Todo.dueToday();
    const dueLater = await Todo.dueLater();
    const completedItems = await Todo.completedItems();
    const allTodos = await Todo.getTodos();

    if (req.accepts("html")) {
      return res.render("index", {
        allTodos,
        overdue,
        dueToday,
        dueLater,
        completedItems,
        csrfToken: req.csrfToken(),
      });
    } else {
      return res.json({
        overdue,
        dueToday,
        dueLater,
        completedItems,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.post("/todos", async (req, res) => {
  console.log("creating a new todo", req.body);
  try {
    await Todo.addTodo({
      title: req.body.title,
      dueDate: req.body.dueDate,
      completed: false,
    });
    return res.redirect("/");
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.put("/todos/:id", async (req, res) => {
  console.log("Marking a Todo as completed:", req.params.id);
  const todo = await Todo.findByPk(req.params.id);
  try {
    const updatedTodo = await todo.setCompletionStatus(req.body.completed);
    return res.json(updatedTodo);
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.delete("/todos/:id", async (req, res) => {
  console.log("deleting a todo with given ID:", req.params.id);
  try {
    await Todo.remove(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(422).json(error);
  }
});

// app.get("/todos", async function (_request, response) {
//   console.log("getting the list all Todos ...");

//   try {
//     const todos = await Todo.getTodos();
//     return response.json(todos);
//   } catch (error) {
//     console.log(error);
//     return response.status(422).json(error);
//   }
// });

// app.get("/todos/:id", async function (request, response) {
//   try {
//     const todo = await Todo.findByPk(request.params.id);
//     return response.json(todo);
//   } catch (error) {
//     console.log(error);
//     return response.status(422).json(error);
//   }
// });

module.exports = app;
