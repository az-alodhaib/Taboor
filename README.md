taboor-app 
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
|
------------------------------------
1- frontend ->
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
-----------------------------------
2- backend ->
│   ├── server.js
│   ├── routes/
│   ├── models/
│   └── utils/
-----------------------------------
3-  database ->
 │   └── taboor.db
-----------------------------------
about sever.js file:-
from line 3-7 => 
// STEP 1: Import Required Packages
// Think of these as tools we need to build our server
from line 13-16 =>
// STEP 2: Create the Application
from line 21-27 => 
// STEP 3: Setup Middleware
// Middleware = tools that process requests before they reach our code
from line 33-58 =>
// STEP 4: Setup Database
from 61-187 =>
// =============================================
// STEP 5: API Routes (Endpoints)
// =============================================
// Routes = URLs that frontend can call to do actions
from line 191-196 =>
// =============================================
// STEP 6: Start the Server
// =============================================
from line 200-208 =>
// =============================================
// STEP 7: Handle Server Shutdown
// =============================================
