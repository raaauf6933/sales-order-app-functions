const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const app = express();
var serviceAccount = require("./permissions.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors({ origin: true }));
const fcn = functions.region("asia-southeast1");

const db = admin.firestore();

app.get("/users", async (req, res) => {
  try {
    const result = await db.collection("users").get();

    const data = [];
    result.forEach((doc) => {
      data.push(doc.data());
    });
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/verify_account", async (req, res) => {
  console.log(req.body);
  const { email, role } = req.body;
  try {
    let result;

    if (role === "CUSTOMER") {
      result = await db
        .collection("customers")
        .where("email", "==", email)
        .get();
    } else if (role === "STORE_ADMIN") {
      result = await db.collection("users").where("email", "==", email).get();
    }

    if (result.empty)
      return res
        .status(404)
        .json({ code: "UNAUTHORIZED", message: "User is unauthorized" });

    const data = [];
    result.forEach((doc) => {
      data.push(doc.data());
    });
    return res.status(200).json({ data: { ...data[0], role } });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/verify_customer", async (req, res) => {
  try {
    const result = await db
      .collection("customers")
      .where("email", "==", req.body.email)
      .get();

    if (result.empty)
      return res
        .status(404)
        .json({ code: "UNAUTHORIZED", message: "User is unauthorized" });

    const data = [];
    result.forEach((doc) => {
      data.push(doc.data());
    });
    return res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error });
  }
});

// exports.helloWorld = fcn.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", { structuredData: true });
//   response.send("Hello from Firebase!");
// });

exports.app = fcn.https.onRequest(app);
