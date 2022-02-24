/* ###############################################################
Importacion de modulos, debes estar previamente instalados.
############################################################### */

const express = require("express");
const {cyan, bgRed} = require("chalk");
const listen = require("socket.io");
const MongoClient = require('mongodb').MongoClient;
const { AttributeIds, OPCUAClient, TimestampsToReturn } = require("node-opcua");  //cliente opc ua

/* ###############################################################
Creacion de constantes para la comunicacion y la db
############################################################### */
// opc ua
const endpointUrl = "opc.tcp://DESKTOP-OKMPSQA:4840"; //uri del servidor
const nodeIdToMonitor = "ns=4;s=|var|CODESYS Control Win V3 x64.Application.PLC_PRG.qw"; 

//  aplicacion web
const port = 3800;

// mongo db
const uri = "mongodb+srv://cpi_user:letmegetin@tutorialdb-wvnkx.mongodb.net/test?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri, { useNewUrlParser: true });

/* ###############################################################
El codico principal va en la funcion async
############################################################### */

(async () => {
    try {
        //crear el cliente opcua 
        const client = OPCUAClient.create();

        //avisar cuando se esta intentando reconectar
        client.on("backoff", (retry, delay) => {
            console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
        });
        
        //mostrar las conexiones
        console.log(" connecting to ", cyan(endpointUrl)); //cyan es para dar color
        await client.connect(endpointUrl);  //iniciar conexion
        console.log(" connected to ", cyan(endpointUrl));

        //iniciar la sesion para interactuar con el servidor opc ua
        const session = await client.createSession();
        console.log("sesion inciada");
        console.log(session);
        //crear una suscripcion
        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 200,
            requestedMaxKeepAliveCount: 20,
            publishingEnabled: true,
        });
        
        subscription.on("keepalive", function () {
            console.log("keepalive");
        }).on("terminated", function () {
            console.log(" TERMINATED ------------------------------>")
        });
        
        // se inicia a monitorear la variable del servidor opcua
        const itemToMonitor = {
            nodeId: nodeIdToMonitor, //variable a monitorear
            attributeId: AttributeIds.Value
        };
        const parameters = {
            samplingInterval: 50, //tiempo de muestreo
            discardOldest: true,
            queueSize: 100
        };
        const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);
        
        // --------------------------------------------------------
        //aqui vamos a interactuar con la pagina web
        const app = express();
        app.set('view engine', 'html');
        app.use(express.static(__dirname + '/')); // definir el directorio de estaticos
        app.set('views', __dirname + '/');
        app.get("/", function(req, res) {
            res.render('index.html'); //    aqui se llama la pagina html que se va a utilizar
        });

        // --------------------------------------------------------
        // se crea un objeto de conexion a la pagina web corriendo
        // --------------------------------------------------------
        const io = listen(app.listen(port));
        // io.sockets permite comicacion entre el navegador y el servidor
        io.sockets.on('connection', function (socket) {
        });

        //mostrar el url al que se debe conectar para entrar a la pagina web
        console.log("Listening on port " + port);
        console.log("visit http://localhost:" + port);


        // --------------------------------------------------------
        // Conexion a la base de datos
        // --------------------------------------------------------
       
        //await clientmongo.connect();
       
       
        //const collection =  clientmongo.db("mydb").collection("mycollection");


        // --------------------------------------------------------
        //definimos que hacer cuando la variable monitoreada "cambie"
        // --------------------------------------------------------
        monitoredItem.on("changed", (dataValue) => {
            //escribir un documento en la base de datos
            //collection.insertOne({ valor: dataValue.value.value, time: dataValue.serverTimestamp});
             //se emite un mensaje en el canal "message" 
            //console.log("OK")
            io.sockets.emit('message', { 
                //el mensaje contiene:
                value: dataValue.value.value,  //valor de la variable
                timestamp: dataValue.serverTimestamp, //tiempo
                nodeId: nodeIdToMonitor,  //nodeid del nodo opcua
                browseName: ""  //nombre de buesqueda
            });
        });

        // salir al presionar CTRL+C 
        let running = true;
        process.on("SIGINT", async () => {
            if (!running) {
                return; // avoid calling shutdown twice
            }
            console.log("shutting down client");
            running = false;
            await clientmongo.close();
            await subscription.terminate();
            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0);

        });
  
    }
    catch (err) {
        console.log(bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();

