const express = require("express");
const app = express();
var csrf = require("tiny-csrf");
const path = require("path");
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
app.set("views", path.join(__dirname, "views"));
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");

const saltRounds = 10;
app.use(flash());

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csrf("this_should_be_32_charactes_long", ["PUT", "POST", "DELETE"]));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "my-super-secret-key-2781534218903421",
    cookie: {
      maxAge: 24 * 60 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Email-ID" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("serial user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  res.render("index", {
    title: "Todo Application",
    csrfToken: req.csrfToken(),
  });
});

app.get("/todos", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  try {
    const loggedIn = req.user.id;
    const overdue = await Todo.overdue(loggedIn);
    const dueToday = await Todo.dueToday(loggedIn);
    const dueLater = await Todo.dueLater(loggedIn);
    const completedItems = await Todo.completedItems(loggedIn);
    const allTodos = await Todo.getTodos(loggedIn);

    if (req.accepts("html")) {
      res.render("todos", {
        title: "To-Do Manager",
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
  } catch (err) {
    console.log(err);
    return res.status(422).json(err);
  }
});

app.get("/todos", async (_req, res) => {
  console.log("Listing the all Todos ...");

  try {
    const todos = await Todo.findAll();
    return res.json(todos);
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (req, res) {
    try {
      const todo = await Todo.findByPk(req.params.id);
      return res.json(todo);
    } catch (error) {
      console.log(error);
      return res.status(422).json(error);
    }
  }
);

app.get("/signup", async (req, res) => {
  res.render("signup", {
    title: "Sign up",
    csrfToken: req.csrfToken(),
  });
});

app.post("/users", async (req, res) => {
  if (!req.body.firstName) {
    req.flash("error", "Enter your First Name");
    return res.redirect("/signup");
  }
  if (!req.body.email) {
    req.flash("error", "Enter valid Email Id");
    return res.redirect("/signup");
  }
  if (!req.body.password) {
    req.flash("error", "Enter your Password");
    return res.redirect("/signup");
  }
  if (req.body.password < 6) {
    req.flash("error", "Password length should be atleast 6");
    return res.redirect("/signup");
  }
  const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

  try {
    const user = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword,
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
        res.redirect("/");
      } else {
        res.redirect("/todos");
      }
    });
  } catch (err) {
    req.flash("error", err.message);
    return res.redirect("/signup");
  }
});

app.get("/login", async (req, res) => {
  res.render("login", {
    title: "Login",
    csrfToken: req.csrfToken(),
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    res.redirect("/todos");
  }
);

app.get("/signout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/todos", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  if (req.body.title.length < 4) {
    req.flash("error", "Title length should be atleast 4");
    return res.redirect("/todos");
  }
  if (!req.body.dueDate) {
    req.flash("error", "Please select a due date");
    return res.redirect("/todos");
  }

  try {
    await Todo.addTodo({
      title: req.body.title,
      dueDate: req.body.dueDate,
      userId: req.user.id,
    });
    return res.redirect("/todos");
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.put("/todos/:id", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
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

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    console.log("deleting a todo with given ID:", req.params.id);
    try {
      const resul = await Todo.remove(req.params.id, req.user.id);
      return res.json({ success: resul === 1 });
    } catch (error) {
      return res.status(422).json(error);
    }
  }
);
module.exports = app;
