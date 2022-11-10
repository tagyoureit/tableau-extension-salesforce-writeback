const { Client } = require('pg')


let main = async () => {

  const client = new Client(
    {
      host: "ec2-44-195-100-240.compute-1.amazonaws.com",
      database: "d6khl2b75mr0am",
      user: "fpmaedlhllhutk",
      port: 5432,
      password: "9a13d4cd319fcb639a5074bc4fa81e3225b11664b877b9d168f351a1f0638ba4",
      ssl: {
        rejectUnauthorized: false
      }
    }
  )
  // await client.connect()
  // const res = await client.query('SELECT $1::text as message', ['Hello world!'])
  // console.log(res.rows[0].message) // Hello world!
  // let res2 = await client.query('select * from SalesTerritories');
  // console.log(JSON.stringify(res2));
  // await client.end()
  let data = ["abc", "def", 333];
   return client.connect().then(() => {
    console.log(`client connected`);
    // self.client = client;

  })
    .then(() => {
      console.log(`sending data:`);
      console.log(data);
      let text = 'insert into SalesTerritories (territory, ae, account) VALUES($1, $2, $3) RETURNING *;';

           // WORKS
       client.query(text, data, (err, res)=>{
              if (err){
                console.log(err)
              }
              else{
                console.log(res);
              }
            })
      /*  client.query(text, data)
        .then(_r => {
          console.log('done')
          console.log(_r);
        })
        .catch(e => {
          console.log('error')
          console.log(e);
        }) */
      /*         .then((result) => {
                // toast.success(`Wrote ${JSON.stringify(res)}`);
                console.log(`wrote data: ${JSON.stringify(result)}`);
                // res.send(result);
              })
              .then(client.end)
              .then(() => {
                console.log(`Client disconnected.`)
              })
              .catch(err => {
                // toast.error(err.message);
                return err.message;
              });
          }); */
    })
    .then(()=>{
      client.end();
    })
  return;
}

main().then(() => { console.log('done.') })
.then(()=>{console.log('here...')})
  .catch(e => { console.log(e); })
