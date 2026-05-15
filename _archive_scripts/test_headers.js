const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(Buffer.from('<svg></svg>'));
});
const server = app.listen(3000, () => {
    const http = require('http');
    http.get('http://localhost:3000', (resp) => {
        console.log('Headers:', resp.headers);
        server.close();
        process.exit(0);
    });
});
