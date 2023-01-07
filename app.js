const express = require("express");
const app = express();
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const { adminModel, electionModel, questionsModel, optionModel, voterModel } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStratergy = require("passport-local");

const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret String"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "my-super-secret-key-2478225678434267",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(async function (request, response, next){
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  "Admin",
  new LocalStratergy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async function (username, password, done){
      console.log("Hello there");
      adminModel.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            done(null, false, { message: "Invalid password!" });
          }
        })
        .catch((err) => {
          console.log(err);
          return done(null, false, { message: "Invalid Email ID!" });
        });
    }
  )
);

passport.use(
  "Voter",
  new LocalStratergy(
    {
      usernameField: "VoterID",
      passwordField: "Password",
    },
    async function (username, password, done) {
      voterModel.findOne({ where: { VoterID: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.Password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid Password!" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Email ID!" });
        });
    }
  )
);

passport.serializeUser(async function (user, done) {
  done(null, { id: user.id, role: user.role });
});
passport.deserializeUser(async function (id, done){
  if (id.role === "admin") {
    adminModel.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  } else if (id.role === "voter") {
    voterModel.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  }
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

//main page
app.get("/", async function (request, response) {
  if (request.user) {
    console.log(request.user);
    if (request.user.role === "admin") {
      return response.redirect("/elections");
    } else if (request.user.role === "voter") {
      request.logout((err) => {
        if (err) {
          return response.json(err);
        }
        response.redirect("/");
      });
    }
  } else {
    response.render("index", {
      title: "Online Voting Platform",
      csrfToken: request.csrfToken(),
    });
  }
});

//signup page
app.get("/signup", async function (request, response) {
  response.render("signup", {
    title: "Create Admin Account",
    csrfToken: request.csrfToken(),
  });
});

//creating user account
app.post("/admin", async function (request, response) {
  if (!request.body.firstName) {
    request.flash("error", "Please enter your first name!");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Please enter your email ID!");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Please enter your password!");
    return response.redirect("/signup");
  }
  if (request.body.password.length < 8) {
    request.flash("error", "Your password length should be atleast 8 characters!");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await adminModel.createAdmin({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", "Email ID is already linked to a user");
    return response.redirect("/signup");
  }
});

//user login page
app.get("/login", async function (request, response) {
  if (request.user) {
    return response.redirect("/elections");
  }
  response.render("login", {
    title: "Login to your account",
    csrfToken: request.csrfToken(),
  });
});

//user elections page
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      let loggedinuser = request.user.firstName + " " + request.user.lastName;
      try {
        const elections = await electionModel.getElections(request.user.id);
        if (request.accepts("html")) {
          response.render("elections", {
            title: "Online Voting Platform",
            userName: loggedinuser,
            elections,
          });
        } else {
          return response.json({
            elections,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//user login
app.post(
  "/session",
  passport.authenticate("Admin", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async function (request, response) {
    response.redirect("/elections");
  }
);

//signout function
app.get("/signout", async function (request, response, next) {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});


//voter login page
app.get("/election/:url/voter", async function (request, response) {
  response.render("voter_login", {
    title: "Login in as Voter",
    url: request.params.url,
    csrfToken: request.csrfToken(),
  });
});

//voter login
app.post(
  "/election/:url/voter",
  passport.authenticate("Voter", {
    failureFlash: true,
  }),
  async function (request, response) {
    return response.redirect(`/election/${request.params.url}`);
  }
);


//reseting password page
app.get(
  "/user_password_reset",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      response.render("user_password_reset", {
        title: "Reset your password",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reseting password function
app.post(
  "/user_password_reset",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      if (!request.body.old_password) {
        request.flash("error", "Please enter your old password");
        return response.redirect("/user_password_reset");
      }
      if (!request.body.new_password) {
        request.flash("error", "Please enter a new password");
        return response.redirect("/user_password_reset");
      }
      if (request.body.new_password.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect("/user_password_reset");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      const result = await bcrypt.compare(
        request.body.old_password,
        request.user.password
      );
      if (result) {
        try {
          adminModel.findOne({ where: { email: request.user.email } }).then(
            (user) => {
              user.resetPass(hashedNewPwd);
            }
          );
          request.flash("success", "Password changed successfully");
          return response.redirect("/elections");
        } catch (error) {
          console.log(error);
          return response.status(422).json(error);
        }
      } else {
        request.flash("error", "Old password does not match");
        return response.redirect("/user_password_reset");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//new election starting page
app.get(
  "/elections/create",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      return response.render("newelection", {
        title: "Create an election",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//creating new election function
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response){
    if (request.user.role === "admin") {
      if (request.body.ElectionName.length < 5) {
        request.flash("error", "Election name length should be atleast 5");
        return response.redirect("/elections/create");
      }
      if (request.body.url.length < 3) {
        request.flash("error", "URL String length should be atleast 3");
        return response.redirect("/elections/create");
      }
      if (
        request.body.url.includes(" ") ||
        request.body.url.includes("\t") ||
        request.body.url.includes("\n")
      ) {
        request.flash("error", "URL String cannot contain spaces");
        return response.redirect("/elections/create");
      }
      try {
        await electionModel.addElection({
          ElectionName: request.body.ElectionName,
          url: request.body.url,
          adminID: request.user.id,
        });
        return response.redirect("/elections");
      } catch (error) {
        request.flash("error", "Email ID is already in use");
        return response.redirect("/elections/create");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//election stats page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.id);
        const numberOfQuestions = await questionsModel.getNumberOfQuestions(
          request.params.id
        );
        const numberOfVoters = await voterModel.getNumberOfVoters(request.params.id);
        return response.render("election_details_page", {
          id: request.params.id,
          title: election.ElectionName,
          url: election.url,
          Launch: election.Launch,
          nq: numberOfQuestions,
          nv: numberOfVoters,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//managing questions page
app.get(
  "/elections/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.id);
        const questions = await questionsModel.getQuestions(request.params.id);
        if (!election.Launch) {
          if (request.accepts("html")) {
            return response.render("questions", {
              title: election.ElectionName,
              id: request.params.id,
              questions: questions,
              csrfToken: request.csrfToken(),
            });
          } else {
            return response.json({
              questions,
            });
          }
        } else {
          request.flash("error", "Cannot edit while election is running!");
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//adding question page
app.get(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.id);
        if (!election.Launch) {
          return response.render("new_question", {
            id: request.params.id,
            csrfToken: request.csrfToken(),
          });
        } else {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//adding question in the election
app.post(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response){
    if (request.user.role === "admin") {
      if (request.body.QuestionName.length < 5) {
        request.flash("error", "Question length should be atleast 5");
        return response.redirect(
          `/elections/${request.params.id}/questions/create`
        );
      }

      try {
        const election = await electionModel.getElection(request.params.id);
        if (election.Launch) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await questionsModel.addQuestion({
          QuestionName: request.body.QuestionName,
          Description: request.body.Description,
          electionID: request.params.id,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${question.id}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//editing a question page
app.get(
  "/elections/:electionID/questions/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.electionID);
        if (election.Launch) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await questionsModel.getQuestion(request.params.questionID);
        return response.render("edit_question", {
          electionID: request.params.electionID,
          questionID: request.params.questionID,
          questionTitle: question.QuestionName,
          questionDescription: question.Description,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//editing a question function
app.put(
  "/questions/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      if (request.body.QuestionName.length < 5) {
        request.flash("error", "Question length should be atleast 5");
        return response.json({
          error: "Question length should be atleast 5",
        });
      }
      try {
        const UpdatedQuestion = await questionsModel.updateQuestion({
          QuestionName: request.body.QuestionName,
          Description: request.body.Description,
          id: request.params.questionID,
        });
        return response.json(UpdatedQuestion);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//deleting question
app.delete(
  "/elections/:electionID/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const nq = await questionsModel.getNumberOfQuestions(
          request.params.electionID
        );
        if (nq > 1) {
          const res = await questionsModel.deleteQuestion(request.params.questionID);
          return response.json({ success: res === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//questions page
app.get(
  "/elections/:id/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const question = await questionsModel.getQuestion(request.params.questionID);
        const options = await optionModel.getOptions(request.params.questionID);
        const election = await electionModel.getElection(request.params.id);
        if (election.Launch) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (request.accepts("html")) {
          response.render("question_options_page", {
            title: question.question,
            description: question.Description,
            id: request.params.id,
            questionID: request.params.questionID,
            options,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            options,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//adding options page function
app.post(
  "/elections/:id/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.questionID}`
        );
      }
      try {
        const election = await electionModel.getElection(request.params.id);
        if (election.Launch) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        await optionModel.addOption({
          option: request.body.option,
          questionID: request.params.questionID,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.questionID}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//deleting options page function
app.delete(
  "/options/:optionID",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const res = await optionModel.deleteOption(request.params.optionID);
        return response.json({ success: res === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//editing options page
app.get(
  "/elections/:electionID/questions/:questionID/options/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.electionID);
        if (election.Launch) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const option = await optionModel.getOption(request.params.optionID);
        return response.render("option_edit_page", {
          option: option.option,
          csrfToken: request.csrfToken(),
          electionID: request.params.electionID,
          questionID: request.params.questionID,
          optionID: request.params.optionID,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//updating options page function
app.put(
  "/options/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.json({
          error: "Please enter option",
        });
      }
      try {
        const updatedOption = await optionModel.updateOption({
          id: request.params.optionID,
          option: request.body.option,
        });
        return response.json(updatedOption);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//voters list page
app.get(
  "/elections/:electionID/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const voters = await voterModel.getVoters(request.params.electionID);
        const election = await electionModel.getElection(request.params.electionID);
        if (request.accepts("html")) {
          return response.render("voters", {
            title: election.ElectionName,
            id: request.params.electionID,
            voters,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            voters,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//adding voters page
app.get(
  "/elections/:electionID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      response.render("new_voter", {
        title: "Add a voter to election",
        electionID: request.params.electionID,
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add voter to election
app.post(
  "/elections/:electionID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      if (!request.body.VoterID) {
        request.flash("error", "Please enter VoterID");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      if (!request.body.Password) {
        request.flash("error", "Please enter password");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      if (request.body.Password.length < 8) {
        request.flash("error", "Password length should be atleast 8 characters");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      const hashedPwd = await bcrypt.hash(request.body.Password, saltRounds);
      try {
        await voterModel.createVoter({
          VoterID: request.body.VoterID,
          Password: hashedPwd,
          electionID: request.params.electionID,
        });
        return response.redirect(
          `/elections/${request.params.electionID}/voters`
        );
      } catch (error) {
        request.flash("error", "Voter ID already in use");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//deleting a voter
app.delete(
  "/elections/:electionID/voters/:VoterID",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const res = await voterModel.deleteVoter(request.params.VoterID);
        return response.json({ success: res === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//voter password reseting
app.get(
  "/elections/:electionID/voters/:VoterID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      response.render("voter_password_reset", {
        title: "Reset voter password",
        electionID: request.params.electionID,
        VoterID: request.params.VoterID,
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reseting user password
app.post(
  "/elections/:electionID/voters/:VoterID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response){
    if (request.user.role === "admin") {
      if (!request.body.new_password) {
        request.flash("error", "Please enter a new password");
        return response.redirect("/user_password_reset");
      }
      if (request.body.new_password.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect("/user_password_reset");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      try {
        voterModel.findOne({ where: { id: request.params.VoterID } }).then(
          (user) => {
            user.resetPass(hashedNewPwd);
          }
        );
        request.flash("success", "Password changed successfully");
        return response.redirect(
          `/elections/${request.params.electionID}/voters`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//previewing election
app.get(
  "/elections/:electionID/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const election = await electionModel.getElection(request.params.electionID);
        const questions = await questionsModel.getQuestions(
          request.params.electionID
        );
        let options = [];
        for (let question in questions) {
          const question_options = await optionModel.getOptions(
            questions[question].id
          );
          if (question_options.length < 2) {
            request.flash(
              "error",
              "There should be atleast two options in each question"
            );
            request.flash(
              "error",
              "Please add atleast two options to the question below"
            );
            return response.redirect(
              `/elections/${request.params.electionID}/questions/${questions[question].id}`
            );
          }
          options.push(question_options);
        }

        if (questions.length < 1) {
          request.flash(
            "error",
            "Please add atleast one question in the ballot"
          );
          return response.redirect(
            `/elections/${request.params.electionID}/questions`
          );
        }

        return response.render("vote_preview", {
          title: election.ElectionName,
          electionID: request.params.electionID,
          questions,
          options,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//launching an election
app.put(
  "/elections/:electionID/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.user.role === "admin") {
      try {
        const launchedElection = await electionModel.launchElection(
          request.params.electionID
        );
        return response.json(launchedElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Voting constraints
app.get("/election/:url/", async function (request, response) {
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/e/${request.params.url}/voter`);
  }
  try {
    const election = await electionModel.getElectionURL(request.params.url);
    if (request.user.role === "voter") {
      if (election.Launch) {
        const questions = await questionsModel.getQuestions(election.id);
        let options = [];
        for (let question in questions) {
          options.push(await optionModel.getOptions(questions[question].id));
        }
        return response.render("vote", {
          title: election.ElectionName,
          electionID: election.id,
          questions,
          options,
          csrfToken: request.csrfToken(),
        });
      } else {
        return response.render("errorpg");
      }
    } else if (request.user.role === "admin") {
      request.flash("error", "You cannot vote as Admin");
      request.flash("error", "Please signout as Admin before trying to vote");
      return response.redirect(`/elections/${election.id}`);
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.use(async function (request, response){
  response.status(404).render("errorpg");
});

module.exports = app;
