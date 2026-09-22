const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const files = { '/': ['index.html','text/html'], '/app.html': ['app.html','text/html'], '/review.bundle.js': ['review.bundle.js','text/javascript'] };
const weights = { 400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold' };
for (const [weight, name] of Object.entries(weights)) files['/inter-'+weight+'.ttf'] = [path.resolve(__dirname,'../../assets/fonts/inter/Inter-'+name+'.ttf'),'font/ttf'];
http.createServer((req,res)=>{
  const item=files[new URL(req.url,'http://127.0.0.1').pathname];
  if(!item){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',item[1]);res.setHeader('Cache-Control','no-store');
  fs.createReadStream(path.resolve(__dirname,item[0])).on('error',()=>{res.writeHead(404);res.end();}).pipe(res);
}).listen(8882,'127.0.0.1',()=>console.log('Native component review: http://127.0.0.1:8882'));
