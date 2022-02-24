/* IMPORTACION DE MODULOS*/

const express = require("express");
const {cyan ,bgRed} =require("chalk");
const listen = require("socket.io");
const MongoClient = require("mongodb").MongoClient;
const {AttributeIds, OPCUAClient, TimestampsToReturn} = require("node-opcua");


/* cREACION DE CONSTANTES PARA LA COMUNICACION Y LA db*/

/* opc ua*/
const endpointUrl = "opc.tcp://LAPTOP-6E74R8F0:4840"; /*uaexpert server click derecho propiedades url */
const nodeIDToMonitor = "ns=4;s=|var|CODESYS Control Win V3 x64.Application.GVL.NIVEL" ;/* conectar al servidor buscar la variable en plc program click sobre la variable aparece una pestaña a la derecha y damos doble click sobre el value de nodeid copiamos el identifier*/

/*aplicación web */
const port = 3700;

/* mongo db*/
const uri ="mongodb+srv://rus1218:<palomino1218>@balanceodemateria.1bpgn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri,{useNewUrlParser: true});


/* Codigo Principan con función async*/

(async () => { //await
    try{
        //crear el cliente de opc ua
        const client = OPCUAClient 

        //avisar cuando se está intendando reconectar
        client.on("backoff",(retry, delay) => {
            console.log("Retrying to connect to", endpointUrl, "attempt",retry);
        });

        //mostrar las URl cuando logre conectar
        console.log("connecting to ", cyan(endpointUrl));
        await client.connect(endpointUrl);
        console.log(" connected to ", cyan(endpointUrl));

        //iniciar la sesion para interactuar con el servidor opc ua
        const session = await client.createSession();
        console.log("Session Iniciada", yellow);

        //Crear una suscripcion
        const subscripcion = await session.createSubscription2({
            requestedPublishingInterval:200, /* milisegundos*/
            requestedMaxKeepAliveCount:20, /*cantidad de veces que se intenta la reconexion */
            publishingEnabled:true,
        });

        //Se inicia el minitoreo de la variable del servidor opcua

        //crear el item con su nodeid y atributo
        const itemToMonitor ={
            nodeID: nodeIDToMonitor, //variable a monitorear}
            atributeId: AttributeIds.Value
        };

        //Definir los parametros de monitoreo
        const parameters = {
            samplingInterval: 50, //tiempo de muestreo
            discard0ldest: true, 
            queueSize: 100
        };

        //crear objeto de monitoreo
        const monitoredItem = await subscripcion.monitor(itemToMonitor,parameters,TimestampsToReturn.Both);
        

        //crear la aplicacion WEB


        //Crear la aplicacion
        const app = express();
        app.set("view engine", "html");
        //definir el directorio de estaticos
        app.use(express.static(__dirname + '/')), // definir el directorio de estaicos
        app.set('views', __dirname + '/');

        //definir como se responde cuando el navegador solicita entrar
        app.get('/', function(req,res){
            res.render('index.html'); //aqui se llama la pagina html que se va a utilizar
        });


        //Se crea un objeto listen para enviar datos a la aplcacion web
        //io.socket ---> "real time bidirectional event-based communication"

        //asociar el puerto a la aplicacion web
        const io = listen(app.listen(port));

        //esperar la conexion
        io.socket.on('connection', function(socket){
        });

        //mostrar el url para entrar a la aplicaccion web
        console.log("listening on port " + port);
        console.log("visit http://localhost:" + port);

        //conexion a la base de datos 

        //conectar el cliente
        await clientmongo.connect();

        //conectarse a la conexion con los datos de mongodb atlas
        const collection = clientmongo.db("mydb").collection("mycollection");

        //definimos que hacer cuando la variable monitoreada "cambie"

        monitoredItem.on("changed", (dataValue) => {
            //escribir en la base de datos
            collection.insertOne({
                valor: dataValue.value.value, 
                time: dataValue.serverTimestamp
            });
            io.socket.emit("message", {
                //el mensaje contiene:
                value: dataValue.value.value, //valor de la variable
                timestamp: dataValue.serverTimestamp, //tiempo
                nodeId: nodeIDToMonitor, //node id del nodo opcua
                browseName: "Nombre" //nombre de busqueda
            });

        });

        //permite salir al precionar Ctrl + c

        let running = true;
        process.on("SIGINT", async() => {
            if (!running){
                return; //avoid calling shutdown twice
            }
            console.log("shutting down client");
            running = false;
            await clientmongo.close();
            await subscripcion.terminate();
            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0); 
        });
    

    }
    catch (err){
        //aqui ponemos que pasa si al intentar lo anterior, hay un errror.
        console.log(bgRed.white("Error " + err.message));
        console.log(err);
        process.exit(-1);
    }
})(); //la funcion se está ejecutando