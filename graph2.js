
let gauge;
let vbar;
let canvas1;
let canvas2;
let table;
let obj = null;     //objeto donde se crea el diagrama de lineas
let obj2 = null;     //objeto donde se crea el diagrama de lineas
let data      = []; //datos en la grafica, al inicio vacio despues se llena
let data2 = []
let flag1 = false;
const numvalues = 200; //numero de valores en la grafica
// preparar el array con valores nulos inicialmente
for (let i=0; i<numvalues; ++i) { data.push(null); }

canvas1    = document.getElementById("cvs_line");
/*
Se utiliza la funcion onload para crear o inicializar las graficas cuando se carga la pagina
*/
window.onload = function () {
    //obtener el canvas donde esta la grafica de lineas
    
    gauge  = new RGraph.Gauge({
        id: 'cvs_gauge',
        min: 0,
        max: 200,
        value: 46,
            options: {
                centery: 120,
                radius: 130,
                anglesStart: RGraph.PI,
                anglesEnd: RGraph.TWOPI,
                needleSize: 85,
                borderWidth: 0,
                shadow: false,
                needleType: 'line',
                colorsRanges: [[0,170,'#0f0'], [170,190,'yellow'],[190,200,'red']],
                borderInner: 'rgba(0,0,0,0)',
                borderOuter: 'rgba(0,0,0,0)',
                borderOutline: 'rgba(0,0,0,0)',
                centerpinColor: 'rgba(0,0,0,0)',
                centerpinRadius: 0
            }
    }).grow();

    obj = new RGraph.Line({
        id: 'cvs_line',
        data:[],
        options: {
            colors: ['black'],
            linewidth: 0.75,
            shadow: false,
            tickmarksStyle: null,
            marginTop: 10,
            marginBottom: 15,
            marginRight: 40,
            backgroundGridVlines: false,
            yaxisPosition: 'right',
            yaxisTickmarksCount: 3,
            xaxisTickmarksCount: 0,
            yaxisLabelsCount: 5,
            xaxis: false
        }
    });  

    vbar =  new RGraph.VProgress({
        id: 'cvs_vbar',
        min: 0,
        max: 200,
        value: '89',
        options: {
            marginRight:35,
            textSize: 12,
            tickmarks: 100,
            tickmarksOuter: 20,
            margin: 5
        }
    }).grow()

    table = new Tabulator("#alarm-table", {
        height:205, 
        data:[], //datos
        layout:"fitColumns", //fit columns to width of table (optional)
        columns:[ //Define Table Columns
            {title:"Tiempo", field:"t", width:150},
            {title:"Valor", field:"v", hozAlign:"left"},
            {title:"Alarma", field:"a"},
        ],
   });
   
}

function drawLine(value) {  
    if (!obj) return;
    RGraph.Clear(canvas1);  
    const len = data.length;
    data.push(value); //se agrega el valor al final del arreglo
    if (data.length > numvalues) {
        data = RGraph.arrayShift(data); //esto descarta el primer valor del array
    }
    obj.original_data[0]  = data; //actualiza los valores
 
    obj.draw();  //render  
}

const socket = io.connect('http://localhost:3800');

socket.on('message', function (data) {

    drawLine(data.value);
    gauge.value = data.value;
    gauge.grow();
    vbar.value = data.value;
    vbar.grow();
    //info.innerHTML = "nodeId= " + data.nodeId + " timestamp= "+ data.timestamp;
    if (data.value < 10 && flag1 == false){
        flag1 = true;
        data2 = table.getData();
        data2.push({t:data.timestamp, v:data.value, a:"Valor muy bajo"})
        table.setData(data2)
    } else if (flag1 == true && data.value > 11){
        flag1 = false;
    }
});
