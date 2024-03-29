const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { promisify } = require("util");

exports.register = (req, res) => {
  console.log(req.body);

  const { full_name, email, password, confirmed_password } = req.body;

  if (!full_name) {
    return res.status(400).json({
      message: "Please provide your full name",
    });
  } else if (!email) {
    return res.status(400).json({
      message: "Please provide your email",
    });
  } else if (!password) {
    return res.status(400).json({
      message: "Please provide a password",
    });
  } else if (password !== confirmed_password) {
    return res.status(400).json({
      message: "Passwords do not match",
    });
  }

  pool.query(
    "SELECT email FROM users WHERE email = ?",
    [email],
    async (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          error,
        });
      }

      if (results.length > 0) {
        return res.status(400).json({
          message: "email already in use",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 8);

      pool.query(
        "INSERT INTO users SET ?",
        { full_name, email, password: hashedPassword },
        (error, results) => {
          if (error) {
            console.log(error);
            return res.status(500).json({
              error,
            });
          }

          console.log(results);
          return res.status(200).json({
            message: "registration successful",
          });
        }
      );
    }
  );
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Please provide your email",
    });
  } else if (!password) {
    return res.status(400).json({
      message: "Please provide your password",
    });
  }

  pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (error, results) => {
      if (error) {
        return res.status(500).json({
          error,
        });
      }

      if (!results || !(await bcrypt.compare(password, results[0].password))) {
        return res.status(400).json({
          message: "email or password is incorrect",
        });
      }

      const user_id = results[0].user_id;
      const jwtToken = jwt.sign({ user_id }, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      });

      const cookieOptions = {
        expires: new Date(
          Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
      };

      res.cookie("jwtToken", jwtToken, cookieOptions);
      res.status(200).json({
        message: "login successful",
        token: jwtToken,
      });
    }
  );
};

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwtToken) {
    try {
      const decodedData = await promisify(jwt.verify)(
        req.cookies.jwtToken,
        "qwe123"
      );

      pool.query(
        "SELECT * FROM users WHERE user_id = ?",
        [decodedData.user_id],
        (error, results) => {
          if (error) {
            console.log(error);
            return res.status(500).json({
              error,
            });
          }

          req.user = results[0];
          return next();
        }
      );
    } catch (err) {
      return res.status(502).json({
        err,
      });
    }
  } else {
    next();
  }
};

exports.logout = (req, res) => {
  res.cookie("jwtToken", "dummy", {
    expires: new Date(Date.now() + 2000),
    httpOnly: true,
  });

  res.status(200).json({
    message: "logout successful",
  });
};
