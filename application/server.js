//모듈 설정
const express = require('express');
const path = require('path');
const fs = require('fs');

const FabricCAServices = require('fabric-ca-client');
const { Gateway, Wallets } = require('fabric-network');

const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('./CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('./AppUtil.js');

const app = express();

//connection.json 객체화
const ccpPath = path.resolve(__dirname, "connection-org1.json");
const walletPath = path.join(__dirname, 'wallet');

const mspOrg1 = 'Org1MSP';
const ccp = buildCCPOrg1();
const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

//미들웨어 설정
app.use('/views', express.static(path.join(__dirname, "views")));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//서버 설정
const PORT = 3000;
const HOST = '0.0.0.0';

//루트 라우팅
app.get('/', (req, res) => {
    res.redirect('/main')
});

app.get('/main', (req, res) => {
    let context = {};

    req.app.render('main', context, (err, html) => {
        if(err){
            console.log("fail to render ejs main page: ", error);
            return;
        }

        res.end(html);
    });
});

app.get('/login', (req, res) => {
    let context = {};

    req.app.render('login', context, (err, html) => {
        if(err){
            console.log("fail to render ejs login page: ", error);
            return;
        }

        res.end(html);
    });
});

app.get('/wallet', (req, res) => {
    let context = {};
    
    req.app.render('wallet', context, (err, html) => {
        if(err){
            console.log("fail to render ejs wallet page: ", error);
            return;
        }

        res.end(html);
    });
});

//관리자 지갑 생성
app.post('/admin', async (req, res) => {
    console.log("Create admin wallet");

    const wallet = await buildWallet(Wallets, walletPath);
    await enrollAdmin(caClient, wallet, mspOrg1);
});

//사용자 지갑 생성
app.post('/user', async (req, res) => {
    let id = req.body.id;
    let pw = req.body.pw;

    console.log("Create user wallet: ", id, pw );

    const wallet = await buildWallet(Wallets, walletPath);
    await registerAndEnrollUser(caClient, wallet, mspOrg1, id, 'org1.department1');
});

//Donation 라우팅
app.post('/letter', async (req, res) => {
    let donorID = req.body.donorID;
    let bloodID = req.body.bloodID;
    let bloodtype = req.body.bloodtype;
    let donationtype = req.body.donationtype;

    console.log('Start : ', donorID, donationtype);
    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);
        
        await gateway.connect(ccp, {
            wallet,
            identity: donorID,
            discovery: { enabled: true, asLocalhost: true }
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("BCDcode");
        await contract.submitTransaction('Donation', donorID, bloodID, bloodtype, donationtype);

        let result = `{"result":"success", "msg":"tx submitted successfully"}`
        let obj = JSON.parse(result);
        console.log("/Donation end -- success ");
        res.status(200).send(obj);
    } catch {
        let result = `{"result":"fail", "msg":"tx hax not submitted"}`
        let obj = JSON.parse(result);
        console.log("/asset end -- failed ", error.stack);
        res.status(200).send(obj);
        return;

    } finally {
        gateway.disconnect();
    }
});

//QueryLetter 라우팅
app.get('/letter', async (req, res) => {
    let donorID = req.query.donorID;
    let bloodID = req.query.bloodID;

    console.log("Start querying letter: ", donorID, bloodID);

    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);

        await gateway.connect(ccp, {
            wallet,
            identity: donorID,
            discovery: { enabled: true, asLocalhost: true }
        });
        
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("BCDcode");
        var result = await contract.evaluateTransaction('QueryLetter', bloodID);
        
        var result = `{"result":"success", "msg":${result}}`
        var obj = JSON.parse(result);
        console.log("Queryblood success");
        res.status(200).send(obj);
    } catch {
        var result = `{"result":"failed", "msg":"failed to Queryblood"}`;
        var obj = JSON.parse(result);
        console.log("Queryblood failed: ", error);
        res.status(200).send(obj);
    } finally {
        gateway.disconnect();
    }
});

//GetMyLetters 라우팅
app.get('/letter/getletters', async (req, res) => {
    let donorID = req.query.donorID;

    console.log("/asset get letters start -- ", donorID);

    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);
		// GW -> connect -> CH -> CC -> submitTransaction
        await gateway.connect(ccp, {
            wallet,
            identity: donorID,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed 
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("BCDcode");
        var result = await contract.evaluateTransaction('GetLetters', donorID);

        // result 가 byte array라고 생각하고
        var result = `{"result":"success", "message":${result}}`;
        console.log("/letter/getletters end -- success", result);
        var obj = JSON.parse(result);
        res.status(200).send(obj);
    } catch (error) {
        var result = `{"result":"fail", "message":"GetLetters has a error"}`;
        var obj = JSON.parse(result);
        console.log("/letter/getletters end -- failed ", error);
        res.status(200).send(obj);
        return;
    } finally {
        gateway.disconnect();
    }
});

//listen
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);