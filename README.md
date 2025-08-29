# Postgres Products API

A tiny REST API for products built with **Node.js/Express** and **PostgreSQL (Neon)**.
It includes bot detection + rate limiting (Arcjet), CI with GitHub Actions, and
auto-deploy to Render.


## Stack
- Node.js 20, Express 5
- PostgreSQL (serverless – Neon client)
- Arcjet (bot detection + rate limit)
- Render (deployment)
- GitHub Actions (CI)


  
 **List products:** https://postgres-backend-5quf.onrender.com/api/products  
- **Get one:** https://postgres-backend-5quf.onrender.com/api/products/1  
- **Health:** https://postgres-backend-5quf.onrender.com/health

 **Write operations** (`POST`, `PUT`, `DELETE`) require an `X-Test-Token` header.  
> For security the token isn’t published; Postman screenshots hide/crop the **Headers** tab.


## Live Demo & Usage

### Create Product (Postman)
_Request:_ `POST /api/products` (JSON body)  
_Response:_ `201 Created` with `{ "success": true, "data": { ... } }` 

<img width="1864" height="1367" alt="image" src="https://github.com/user-attachments/assets/27d026de-0de3-4743-8e9e-fe9f33364e1e" />


Update Product (Postman)
Request: PUT /api/products/:id (JSON body)

<img width="2004" height="1387" alt="image" src="https://github.com/user-attachments/assets/21432ee9-7a66-4742-a3f5-c3075b0271d8" />


Delete Product (Postman)
Request: DELETE /api/products/:id (JSON body)

<img width="1968" height="1437" alt="image" src="https://github.com/user-attachments/assets/e2b34028-1810-421c-89de-2f9110eb4702" />
