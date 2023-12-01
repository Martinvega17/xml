const express = require('express');
const fs = require('fs');
const path = require('path');
var mysql = require('mysql');
const { DOMParser } = require('xmldom');
const { parseString, Builder } = require('xml2js');
const app = express();
const port = 3000;


// Configuración de la conexión a la base de datos MySQL
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'clienserv'
});

connection.connect();

// Ruta para la raíz, sirve el archivo index.html
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});


// Ruta para buscar autos en el archivo XML
app.get('/buscarAutos', (req, res) => {
    const modeloBuscado = req.query.modelo;

    if (!modeloBuscado) {
        res.status(400).send('Debe proporcionar un modelo para buscar.');
        return;
    }

    const autosPath = path.join(__dirname, 'automoviles.xml');
    fs.readFile(autosPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error interno del servidor');
            return;
        }

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');

            const autos = xmlDoc.getElementsByTagName('auto');
            const resultados = [];

            for (let i = 0; i < autos.length; i++) {
                const modelo = autos[i].getElementsByTagName('modelo')[0].textContent;
                if (modelo.toLowerCase().includes(modeloBuscado.toLowerCase())) {
                    resultados.push({
                        marca: autos[i].getElementsByTagName('marca')[0].textContent,
                        modelo: autos[i].getElementsByTagName('modelo')[0].textContent,
                        año: autos[i].getElementsByTagName('año')[0].textContent
                    });
                    // Si se encuentra un resultado, no es necesario buscar más
                    break;
                }
            }

            if (resultados.length > 0) {
                // Configura la respuesta con el tipo de contenido XML
                res.set('Content-Type', 'text/xml');
                res.send(data);
            } else {
                // Envía un mensaje específico si no se encuentran resultados
                res.status(404).send('No se encontraron resultados para el modelo especificado.');
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('Error al procesar el archivo XML');
        }
    });
});




app.post('/guardarAuto', express.json(), (req, res) => {
    const { marca, modelo, año } = req.body;

    if (!marca || !modelo || !año) {
        res.status(400).send('Todos los campos son obligatorios.');
        return;
    }

    const query = `INSERT INTO autos (marca, modelo, año) VALUES (?, ?, ?)`;
    connection.query(query, [marca, modelo, año], (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al guardar el vehículo en la base de datos.' });
            return;
        }

        // Después de la inserción en la base de datos, actualiza el archivo XML
        actualizarArchivoXML(marca, modelo, año);
        res.json({ message: 'Vehículo agregado exitosamente en la base de datos.' });
    });
});

function actualizarArchivoXML(marca, modelo, año) {
    const autosPath = path.join(__dirname, 'automoviles.xml');
    fs.readFile(autosPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            // Manejar el error de lectura del archivo XML
            return;
        }

        try {
            parseString(data, { explicitArray: false }, (err, result) => {
                if (err) {
                    console.error(err);
                    // Manejar el error al procesar el archivo XML
                    return;
                }

                // Agrega el nuevo auto al documento XML
                result.automoviles.auto.push({
                    marca: marca,
                    modelo: modelo,
                    año: año
                });

                // Convierte el objeto actualizado a XML
                const builder = new Builder();
                const nuevoXML = builder.buildObject(result);

                // Escribe el archivo XML actualizado
                fs.writeFile(autosPath, nuevoXML, (err) => {
                    if (err) {
                        console.error(err);
                        // Manejar el error de escritura del archivo XML
                        return;
                    }
                    console.log('Archivo XML actualizado correctamente.');
                });
            });
        } catch (error) {
            console.error(error);
            // Manejar el error al procesar el archivo XML
        }
    });
}



app.listen(port, () => {
    console.log(`El servidor está escuchando en http://localhost:${port}`);
});
