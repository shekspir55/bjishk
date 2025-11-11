Bjishk
Bjishk is very minimal simplistic dectralized healthcheck software
how it work?
1. uesr adds websites he want's to monitor
2. when running bjishk you add smtp to send you emails if a service goes down
3. instances of bjishk are connected with each other in case one goes down other picks up, instances are owned by different people
   1. If another bjishk goes down and your instance monitors it, it will send a messange to the admin saying that their bjishk is down
4. bjishk DB is sqlite, for simlicity



when server is starting it should show you in logs link like this, which sais

 ask pepole to add this in their peers
server_url:admin_email
