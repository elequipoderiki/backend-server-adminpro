var express = require('express');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var SEED = require('../config/config').SEED;

var app = express();
var Usuario = require('../models/usuario');

//google
var CLIENT_ID = require('../config/config').CLIENT_ID;

const {OAuth2Client} = require('google-auth-library');
const usuario = require('../models/usuario');
const client = new OAuth2Client(CLIENT_ID);

//==============================
//autentiacion de google
//==============================

async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    // const userid = payload['sub'];
    // If request specified a G Suite domain:
    // const domain = payload['hd'];
    
    return {
        nombre: payload.name,
        email: payload.email,
        img: payload.picture,
        google: true
    }
}

app.post('/google', async (req, res)=>{
    
    var token = req.body.token;

    var googleUser =  await verify(token)
                        .catch(e => {
                            res.status(403).json({
                                ok: false,
                                mensaje: 'token no valido',
                            });                        
                        });
    
    Usuario.findOne({email: googleUser.email}, (err, usuarioDB)=>{
        if(err){
            return res.status(500).json({
                ok: false,
                mensaje: 'error al buscar usuario',
                errors:  err
            });
        }
        //usuario existe en la base de datos actualmente
        if(usuarioDB){
            //usuario no se autentico con google
            if(usuarioDB.google === false){
                return res.status(400).json({
                    ok: false,
                    mensaje: 'debe usar su autenticación normal'
                });    
            } else {
                //usuario.password = ':)';
                var token = jwt.sign({usuario: usuarioDB}, SEED, { expiresIn: 14400});//4 horas

                res.status(200).json({
                    ok: true,
                    usuario: usuarioDB,
                    token: token,
                    id: usuarioDB._id,
                    menu: obtenerMenu(usuarioDB.role)
                });        
            }
        } else {
            //usuario inexistente en la base de datos 
            //creamos usuario a partir de los datos que envia google
            var usuario = new Usuario();
            usuario.nombre = googleUser.nombre;
            usuario.email = googleUser.email;
            usuario.img = googleUser.img;
            usuario.google = true;
            usuario.password = ':)';

            //guardamos usuario en la base de datos
            usuario.save((err, usuarioDB)=>{
                if(err){
                    return res.status(500).json({
                        ok: true,
                        mensaje: 'error al crear usuario - google',
                        errors: err
                    })
                }
                var token = jwt.sign({usuario: usuarioDB}, SEED, { expiresIn: 14400});//4 horas
                res.status(200).json({
                    ok: true,
                    usuario: usuarioDB,
                    token: token,
                    id: usuarioDB._id,
                    menu: obtenerMenu(usuarioDB.role)
                });        
            });
        }
    });                        
});

//==============================
//autentiacion normal
//==============================
app.post('/', (req, res) => {
    
    var body = req.body;
    Usuario.findOne({ email: body.email}, (err, usuarioDB) => {
        
        if(err) {
            return res.status(500).json({
                ok: false,
                mensaje: 'error al buscar usuario',
                errors: err
            });
        }

        if( !usuarioDB){
            return res.status(400).json({
                ok: false,
                mensaje: 'credenciales incorrectas -email',
                errors: err
            });
        }

        if(!bcrypt.compareSync(body.password, usuarioDB.password)){
            return res.status(400).json({
                ok: false,
                mensaje: 'Credenciales incorrectas - password',
                errors: err
            });
        }

        usuarioDB.password = ':)';

        var token = jwt.sign({usuario: usuarioDB}, SEED, { expiresIn: 14400});//4 horas

        res.status(200).json({
            ok: true,
            usuario: usuarioDB,
            token: token,
            id: usuarioDB._id,
            menu: obtenerMenu(usuarioDB.role)
        });
    });

});

function obtenerMenu(ROLE){
    
    var menu = [
        {
          titulo: 'Principal',
          icono: 'mdi mdi-gauge',
          submenu: [
            { 
              titulo: 'Dashboard',
              url: '/dashboard'
            },
            { 
              titulo: 'ProgressBar',
              url: '/progress'
            },
            { 
              titulo: 'Gráficas',
              url: '/graficas1'
            },
            { 
              titulo: 'Promesas',
              url: '/promesas'
            },
            { 
              titulo: 'RxJs',
              url: '/rxjs'
            }
          ]
        },
        {
          titulo: 'Mantenimientos',
          icono: 'mdi mdi-folder-lock-open',
          submenu: [
            // {
            //   titulo: 'Usuarios',
            //   url: '/usuarios'
            // },
            {
              titulo: 'Hospitales', 
              url: '/hospitales'
            },
            {
              titulo: 'Médicos',
              url: '/medicos'
            }
          ]
        }
      ];

    if(ROLE === 'ADMIN_ROLE'){
        menu[1].submenu.unshift({titulo: 'Usuarios', url: '/usuarios'});
    }
    return menu;
}

module.exports = app;