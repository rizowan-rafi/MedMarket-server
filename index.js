require('dotenv').config()
const express = require('express');
const app = express();
const Stripe = require('stripe');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = Stripe(process.env.STRIPE_SECRECT_KEY);

//middleware
app.use(cors())
app.use(express.json())

const verifyToken = (req, res, next) => {
    // console.log('inside middleware : ', req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'no token found' })
    }
    const token = req.headers.authorization.split(' ')[1]
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(400).send({ message: 'invalid token ' })
        req.decoded = decoded;
        next();
    })

}

app.get('/', (req, res) => {
    res.send("MedMarket server is running")
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.v8zqf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // Database Collection
        const categoryCollection = client.db("MedMarket").collection("categoryCollection")
        const discountCollection = client.db("MedMarket").collection("discounts")
        const cartCollection = client.db("MedMarket").collection("carts")
        const userCollection = client.db("MedMarket").collection("users")
        const paymentCollection = client.db("MedMarket").collection("payments")
        const reviewCollection = client.db("MedMarket").collection("reviews")
        const adCollection = client.db("MedMarket").collection("ads")
        
        // jwt token
        app.post('/jwt',async (req,res)=>{
            try {
                const user = req.body;
                const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
                res.send({ token });
            } catch (error) {
                console.error('JWT error:', error);
                res.status(500).send({ message: 'Internal Server Error' });
            }
        })
        
        // check admin
        app.get('/checkAdmin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'admin' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })
        
        // check seller
        app.get('/checkSeller/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'seller' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })
        
        // check usser
        app.get('/checkUser/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'user' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })

        // route
        app.get('/users', async (req, res) => {
            try {
                const users = await userCollection.find().toArray()
                res.send(users)
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            try {

                const result = await userCollection.insertOne(user)
                res.status(201).send({ success: true })
            }
            catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        })

        app.patch('/user/:email', verifyToken, async (req, res) => {
            try {
                const email = req.params.email;
                const update = req.body;

                const result = await userCollection.updateOne(
                    { email: email },
                    {
                        $set: {
                            image: update.image,
                            userName: update.username,
                        },
                    }
                );

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: "User updated successfully" });
                } else {
                    res.send({ success: false, message: "No changes made or user not found" });
                }
            } catch (err) {
                res.status(500).send({ success: false, message: err.message });
            }
        });
          

        app.patch('/users/:role', async (req, res) => {

            try {
                const role = req.params.role;
                const email = req.query.email;
                const result = await userCollection.updateOne({
                    email: email
                },
                    { $set: { role: role } })
                res.send({ success: true })
            }
            catch (err) {
                res.send({ success: false, message: err.message })
            }
        })

        app.get("/role/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            if (user) {
                res.send({ role: user.role });
            } else {
                res.status(404).send({ message: "User not found" });
            }
        });

        app.get('/sellerMedicine/:seller', async (req, res) => {
            const seller = req.params.seller;
            try {
                const result = await discountCollection.find({ company_name: seller }).toArray()
                res.send(result)
            } catch (err) {
                res.status(500).send({ message: err.message })
            }
        })

        app.get('/categories', async (req, res) => {
            const categories = await categoryCollection.find().toArray()
            res.send(categories);
        })

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const categories = await categoryCollection.findOne({ category_name: id })
            res.send(categories);
        })

        app.patch('/categories/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const product = req.body;

                const result = await categoryCollection.updateOne(
                    { category_name: id },
                    {
                        $set: {
                            category_name: product.category_name,
                            image: product.image
                        }
                    }
                );

                const updateDiscounts = await discountCollection.updateMany(
                    { category: id },
                    { $set: { category: product.category_name } }
                );

                res.send({
                    success: true,
                    updatedCategory: result.modifiedCount,
                    updatedDiscounts: updateDiscounts.modifiedCount
                });
            } catch (err) {
                res.status(500).send({ success: false, error: err.message });
            }
        });

        app.delete('/categories/:id', async (req, res) => {
            try {
                const id = req.params.id

                const result = await categoryCollection.deleteOne({ category_name: id });

                const result1 = await discountCollection.deleteMany({ category: id });

                res.send({
                    success: true,
                    deletedCategoryCount: result.deletedCount,
                    deletedDiscountsCount: result1.deletedCount,
                });
            } catch (err) {
                res.status(500).send({ success: false, error: err.message });
            }
        });



        app.get('/discounts', async (req, res) => {
            const discounts = await discountCollection
                .find({ discount_percentage: { $gt: 0 } })
                .sort({ discount_percentage: -1 })
                .toArray();
            res.send(discounts);
        })
        app.get('/medicines',verifyToken, async (req, res) => {
            const medicines = await discountCollection.find().toArray()
            res.send(medicines)
        })
        app.get('/discounts/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const product = await discountCollection.findOne({ _id: new ObjectId(id) })
            res.send(product);
        })

        app.post('/discounts', async (req, res) => {
            try {
                const product = req.body;

                const result = await discountCollection.insertOne(product);

                if (result.insertedId) {
                    const updateResult = await categoryCollection.updateOne(
                        { category_name: product.category },
                        { $inc: { number_of_medicines: 1 } }
                    );

                    if (updateResult.modifiedCount === 0) {
                        console.warn(`No category found with name: ${product.category}`);
                    }

                    res.status(201).send({ success: true });
                } else {
                    res.status(500).send({ success: false, message: 'Failed to insert medicine' });
                }
            } catch (err) {
                res.status(501).send({ success: false, message: err.message });
            }
        });


        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const products = await discountCollection.find({ category: id }).toArray()
            res.send(products)
        })

        app.get('/carts', async (req, res) => {
            try {
                const carts = await cartCollection.find().toArray();
                res.send(carts)
            }
            catch (err) {
                res.status(500).send({ success: false, message: error.message });

            }
        })

        app.get('/carts/:email',verifyToken, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            try {
                const carts = await cartCollection.find({ userEmail: email }).toArray();
                res.send(carts)
            }
            catch (err) {
                res.status(500).send({ success: false, message: error.message });

            }
        })





        app.post('/carts',verifyToken, async (req, res) => {
            const product = req.body
            try {

                const result = await cartCollection.insertOne(product)
                res.status(201).send({ success: true })
            }
            catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        })

        app.delete('/carts/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;
            // console.log(id)
            try {
                const result = await cartCollection.deleteOne({ id: id, userEmail: email });

                if (result.deletedCount > 0) {
                    res.send({ success: true, message: 'Item deleted successfully' });
                } else {
                    res.status(404).send({ success: false, message: 'Item not found' });
                }
            } catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        });

        app.delete('/cart/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;

            try {
                const result = await cartCollection.deleteOne({ _id: new ObjectId(id), userEmail: email });

                if (result.deletedCount > 0) {
                    res.send({ success: true, message: 'Item deleted successfully' });
                } else {
                    res.status(404).send({ success: false, message: 'Item not found' });
                }
            } catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        });

        app.delete('/cartclear/:email',verifyToken, async (req, res) => {
            const email = req.params.email;

            try {
                const result = await cartCollection.deleteMany({ userEmail: email });

                if (result.deletedCount > 0) {
                    res.send({ success: true, message: 'Item deleted successfully' });
                } else {
                    res.status(404).send({ success: false, message: 'Item not found' });
                }
            } catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        })


        app.patch('/carts/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const { type } = req.body;

            try {
                const item = await cartCollection.findOne({ _id: new ObjectId(id) });

                if (!item) {
                    return res.status(404).send({ success: false, message: 'Item not found' });
                }

                let newQuantity = item.quantity;

                if (type === 'increase') {
                    newQuantity += 1;
                } else if (type === 'decrease' && item.quantity > 1) {
                    newQuantity -= 1;
                }

                const result = await cartCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { quantity: newQuantity } }
                );

                res.send({ success: true, updatedQuantity: newQuantity });
            } catch (error) {
                console.error("Quantity update error:", error);
                res.status(500).send({ success: false, error: error.message });
            }
        });

        app.post('/create-payment-intent', async (req, res) => {
            const { amount } = req.body;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });

                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: error.message });
            }
        });

        app.get('/payments/:email',verifyToken, async (req, res) => {
            try {
                const email = req.params.email
                const result = await paymentCollection.findOne({}, { sort: { _id: -1 } });
                res.send(result)
            }
            catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })

        app.get('/payment/:email', async (req, res) => {
            try {
                const email = req.params.email
                const result = await paymentCollection.find({ email: email }).sort({ _id: -1 }).toArray();
                res.send(result)
            }
            catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })

        app.get('/payments', async (req, res) => {
            try {
                const result = await paymentCollection.find().toArray()
                res.send(result)
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })

        app.patch('/payments/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await paymentCollection.updateOne({
                    _id: new ObjectId(id)
                },
                    {
                        $set: { status: 'paid' }
                    })
                res.send({ success: true })
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })



        app.post('/payments',verifyToken, async (req, res) => {
            try {
                const payment = req.body;
                const result = await paymentCollection.insertOne(payment)
                res.status(200).send({ success: true })
            }
            catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })

        app.get('/pay/:seller', async (req, res) => {

            try {
                const seller = req.params.seller
                const payments = await paymentCollection.find().toArray();
                const result = payments.flatMap((p) => {
                    return p.cart.filter((c) => c.company_name === seller).map(i => ({
                        ...i,
                        status: p.status,
                        paymentId: p._id,
                        date: p.date
                    }))
                })
                res.send(result)
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })

        app.get('/latestPayment', async (req, res) => {
            try {
                const payment = await paymentCollection.find().sort({ _id: -1 }).toArray();
                const result = await Promise.all(
                    payment.flatMap(m => m.cart)
                        .slice(0, 4)
                        .map(async (p) => {
                            const ss = await discountCollection.findOne({ _id: new ObjectId(p.id) }); 
                            return {
                                ...p,
                                category: ss?.category || "Unknown"
                            };
                        })
                );
                  

                

                res.send(result)
            } catch (err) {
                res.send(err)
            }
        })

        app.get('/sales', async (req, res) => {
            try {
                const result = await paymentCollection.find().toArray();
                const r = result.flatMap((payment) =>
                    payment.cart.map((item) => ({
                        company_name: item.company_name,
                        _id: item._id,
                        quantity: item.quantity,
                        per_unit_price: item.per_unit_price,
                        userEmail: item.userEmail,
                        item_name: item.item_name,
                        date: payment.date,
                        status: payment.status
                    }))
                );
                res.send(r);
            }
            catch (err) {
                res.send(err)
            }
        })

        app.get('/userOrder/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const result = await paymentCollection.find({ email: email }).toArray()
                const total = result.reduce((acc, cur) => acc + cur?.cart?.length, 0) || 0

                // const total = result[0]?.total || 0;
                res.send(total)
            } catch (error) {
                res.status(500).send({ success: false, message: err.message })

            }
        })

        app.get('/userPayment/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email)

            try {
                const result = await paymentCollection.find({ email: email }).toArray()
                // console.log(result)
                const total = result.reduce((acc, cur) => acc + cur.amount, 0) || 0

                res.send({ total })
            } catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        });

        app.get('/ads', async (req, res) => {
            try {
                const result = await adCollection.find().toArray()
                res.send(result)
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })

        app.delete

        app.get('/ads/:email', async (req, res) => {
            try {
                const email = req.params.email
                const result = await adCollection.find({ sellerEmail: email }).toArray()
                res.send(result)
            }
            catch (err) {
                res.send({ message: err.message })
            }
        })

        app.get('/adHome', async (req, res) => {
            try {
                const result = await adCollection.find({ status: 'done' }).toArray()
                res.send(result)
            } catch (err) {
                res.send(err)
            }
        })

        app.patch('/ads/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;
                const result = await adCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: status } })
                res.send({ success: true })
            }
            catch (err) {
                res.send({ success: false, message: err.message })
            }
        })

        app.post('/ads', async (req, res) => {
            try {
                const ad = req.body;
                const result = await adCollection.insertOne(ad)
                res.status(201).send({ success: true })

            }
            catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })

        app.get('/reviews', async (req, res) => {
            try {
                const result = await reviewCollection.find().sort({ rating: -1 }).limit(5).toArray()
                res.send(result)
            }
            catch (err) {
                res.send(err)
            }
        })


        app.post('/reviews', async (req, res) => {
            const review = req.body;
            try {
                const result = await reviewCollection.insertOne(review)
                res.status(201).send({ success: true })
            } catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })

        app.get('/reviews/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const result = await reviewCollection.find({ email: email }).sort({ rating: -1 }).toArray()
                res.send(result)
            } catch (err) {
                res.status(500).send({ success: false, message: err.message })
            }
        })






        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    // console.log(`Server running on port ${port}`);
});
