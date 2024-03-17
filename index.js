/*
Assess key=AKIA5FTZEKGZTLSXAFRI
Secret key=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

  npm init -y
  npm install express
  npm install multer
  npm install aws-sdk
  npm install dotenv
  npm i body-parser
  npm install ejs
  ejs bỏ trong views

*/
const parser=require('body-parser');
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
require("dotenv").config();
const path = require("path");
const PORT = 3000;
const app = express();
//
app.use(parser.urlencoded({ extended: true }));
app.use(parser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./views'));
app.set('view engine', 'ejs');
app.set('views', './views');

process.env.AWS_SDK_JS_SUPRESS_MAINTENANCE_MODE_MASSAGE = "1";

AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const tableName = process.env.DYNAMODB_TABLE_NAME;
const dynamodb = new AWS.DynamoDB.DocumentClient();

const storage = multer.memoryStorage({
    destination(req, file, callback) {
        callback(null, "");
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2000000 },
    fileFilter(req, file, cb) {
        checkFileType(file, cb);
    },
});

function checkFileType(file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    return cb("Error: Pls upload images /jpeg|jpg|png|gif/ only!");
}

app.get("/", async (req, res) => {
    try {
        const params = { TableName: tableName };
        const data = await dynamodb.scan(params).promise();

        console.log("data=", data.Items);
        return res.render("index.ejs", { data: data.Items });

    } catch (error) {
        console.error("Error retrieving data from DynamoDB:", error);
        return res.status(500).send("Internal Server Error");
    }
});

app.post("/save", upload.single("image"), (req, res) => {
    try {
        const product_id = req.body.product_id;
        const product_name = req.body.product_name;
        const quantity = Number(req.body.quantity);
        const file = req.file;
        //nếu key là Number thì phải ép kiểu

        const paramsS3 = {
            Bucket: bucketName,
            Key: file.originalname,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read',
        };
        console.log(product_id);
        s3.upload(paramsS3, async (err, data) => {
            if (err) {
                console.error("Error uploading to S3:", err);
                return res.send("Internal server error!");
            } else {
                const imageURL = data.Location;

                const paramsDynamoDb = {
                    TableName: tableName,
                    Item: {
                        product_id: product_id,
                        product_name: product_name,
                        quantity: Number(quantity),
                        image: imageURL,
                    },
                };

                await dynamodb.put(paramsDynamoDb).promise();
                return res.redirect("/");
            }
        });
        
    } catch (error) {
        console.error("Error saving data to DynamoDB:", error);
        return res.status(500).send("Internal Server Error");
    }
});
//Hàm xóa
app.post("/delete", upload.fields([]), async (req, res) => {
    const listCheckboxSelected = Object.keys(req.body);

    if (listCheckboxSelected.length === 0) {
        return res.redirect("/");
    }
    try {
        function onDeleteItem(length) {
            //const maSanPham = String(listCheckboxSelected[length]); // Chuyển đổi sang kiểu dữ liệu chuỗi
            const product_id = String(listCheckboxSelected[length]);
            const paramsDynamoDb = {
                TableName: tableName,
                Key: {
                    product_id: String(listCheckboxSelected[length]),
                    //nếu key là Number thì đổi thành Number
                },
            };
            dynamodb.delete(paramsDynamoDb,(err,data)=> {
                if(err)
                {
                    console.log("error=",err);
                    return res.send("Internal Server Error");
                }
                else
                {
                    if(length>0)
                    {
                        onDeleteItem(length-1);
                    }
                    else
                    {
                        return res.redirect("/");
                    }
                }
            });
        }
        onDeleteItem(listCheckboxSelected.length - 1);
    } catch (error) {
        console.error("Error deleting data from DynamoDB:", error);
        return res.status(500).send("Internal Server Error");
    }
});
//run
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}/`)
});