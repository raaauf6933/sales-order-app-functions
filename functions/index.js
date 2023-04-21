const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const app = express();
var serviceAccount = require("./permissions.json");
const makeid = require("./utils/makeProductId");
const { FieldPath } = require("firebase-admin/firestore");

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
      data.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json({ data: { ...data[0], role } });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/create_product", async (req, res) => {
  const {
    product_description,
    images,
    product_name,
    quantity,
    product_selling_price,
  } = req.body;

  try {
    const result = await db.collection("products").add({
      product_name,
      quantity: 1,
      description: product_description,
      product_id: makeid(7),
      product_selling_price: parseInt(product_selling_price),
      isDeleted: false,
      product_img_url: images[0],
    });

    return res.status(200).json({
      data: {
        id: result.id,
      },
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error });
  }
});

app.post("/edit_product", async (req, res) => {
  const {
    id,
    product_description,
    images,
    product_name,
    quantity,
    product_selling_price,
  } = req.body;

  var productsRef = db.collection("products").doc(id);

  try {
    const result = await productsRef.update({
      product_name,
      quantity: parseInt(quantity),
      description: product_description,
      product_selling_price: parseInt(product_selling_price),
      isDeleted: false,
      product_img_url: images[0],
    });

    res.status(200).json({ result });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/products", async (req, res) => {
  try {
    const result = await db.collection("products").get();

    const data = [];
    result.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json({ data });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/product", (req, res) => {
  const id = req.body.id;

  var docRef = db.collection("products").doc(id);

  docRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        res.status(200).json({ data: { id, ...doc.data() } });
      } else {
        res.status(200).json({ message: "not found" });
      }
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
});

app.post("/create_order", async (req, res) => {
  const { customer_id, order_lines } = req.body;

  let total_amount = 0;

  const productIds = order_lines.map((e) => e.product_id);

  const getProducts = () => {
    return new Promise((res, rej) => {
      db.collection("products")
        .where("product_id", "in", productIds)
        .get()
        .then((querySnapshot) => {
          res(querySnapshot);
        })
        .catch((error) => {
          rej("Error getting documents: ", error);
        });
    });
  };

  const result = await getProducts();
  const products = [];
  result.forEach((doc) => {
    products.push({ id: doc.id, ...doc.data() });
  });

  const updateProductInventory = async (id, quantity) => {
    var productsRef = db.collection("products").doc(id);
    await productsRef.update({
      quantity: parseInt(quantity),
    });
  };

  const createOrderLine = () => {
    const getOrderLine = (order) => {
      const my_orderLine = order_lines.find(
        (e) => e.product_id === order.product_id
      );
      return my_orderLine;
    };

    return products.map((e) => ({
      id: e.id,
      product_id: e.product_id,
      product_name: e.product_name,
      quanty: getOrderLine(e).quantity,
      product_selling_price: e.product_selling_price,
      newQty: e.quantity - getOrderLine(e).quantity,
    }));
  };

  const orderLines = createOrderLine();

  const getCustomer = () => {
    return new Promise((res, rej) => {
      var docRef = db.collection("customers").doc(customer_id);
      docRef
        .get()
        .then((doc) => {
          if (doc.exists) {
            res({ customer_id, ...doc.data() });
          } else {
            rej({ message: "not found" });
          }
        })
        .catch((error) => {
          rej(error);
        });
    });
  };

  const customer = await getCustomer();

  for (let o of orderLines) {
    total_amount = total_amount + o.quanty * o.product_selling_price;

    await updateProductInventory(o.id, o.newQty);

    delete o.newQty;
  }

  try {
    const result = await db.collection("orders").add({
      customer,
      order_lines: orderLines,
      status: "NEW_ORDER",
      totalAmount: total_amount,
    });

    res.status(200).send({ data: { id: result.id } });
  } catch (error) {
    console.log(error.message);
    res.status(400).send({ error: error.message });
  }
});

// exports.helloWorld = fcn.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", { structuredData: true });
//   response.send("Hello from Firebase!");
// });

exports.app = fcn.https.onRequest(app);
