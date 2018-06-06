var express = require('express')
var app = express()
var path = require('path')
var config = require('./config')
var proxy = require('express-http-proxy')
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var request = require('request')
var PORT = config.PORT || 3130

var log4js = require('log4js')
log4js.configure({
  appenders: {
    app: {
      type: 'file',
      filename: '/usr/src/app/nmlog/app.log'
    }
  },
  categories: {
    default: {
      appenders: ['app'],
      level: 'debug'
    }
  }
})
var loggerTest = log4js.getLogger('cmproxy')

var server = app.listen(PORT, function() {
  console.log('Server start at port: ' + server.address().port)
  loggerTest.info('Server start at port: ' + server.address().port)
})
var io = require('socket.io')(server)

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: false
  })
)
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '/static')))
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS')

  if (req.method == 'OPTIONS') {
    res.send(200)
  } else {
    next()
  }
})

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/static/index.html'))
})
app.use(
  '/CMAPI',
  proxy(config.VIP + ':' + config.CMAPI, {
    userResHeaderDecorator(headers, userReq, userRes, proxyReq, proxyRes) {
      // recieves an Object of headers, returns an Object of headers.
      return headers
    }
  })
)
app.use('/CMAPIWIN', proxy(config.VIP + ':' + config.CMAPIWIN))
app.use('/TMSERVICE', proxy(config.VIP + ':' + config.TMSERVICE))
app.use('/FL', proxy(config.VIP + ':' + config.FL))

app.post('/proxy', (req, res, next) => {
  var body = req.body
  console.log(req.body)
  r = request({
    rejectUnauthorized: false,
    method: body.type,
    url: body.url,
    body: body.body,
    headers: {
      'sobeyhive-http-token': body.usertoken,
      'sobeyhive-http-site': 'S1',
      'sobeyhive-http-system': 'WEBCM',
      'sobeyhive-http-tool': 'WEBCM'
    }
  })
    .on('error', function(err) {
      loggerTest.info(
        'request server error: ' + err.stack + '\n------' + JSON.stringify(body)
      )
    })
    .pipe(res)
})
app.get('/ip', (req, res, next) => {
  let ip = (
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress ||
    ''
  ).match(/\d+.\d+.\d+.\d+/)
  res.send(ip ? ip.join('.') : '127.0.0.1')
  res.end()
})
io.on('connection', function(socket) {
  loggerTest.info('a user connected:' + socket.id)
  socket.on('disconnect', function() {
    loggerTest.info('disconected:' + socket.id)
  })
})
