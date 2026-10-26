import { createPortfolioServer } from './index.mjs';
const server=await createPortfolioServer({origin:'http://127.0.0.1:4200'});server.listen(4300,'127.0.0.1',()=>console.log('Development API on port 4300; Angular on port 4200.'));
