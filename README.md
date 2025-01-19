# react-lerna-mono-repo-02
A mono repo with independent packages

1. cd C:\Projects\react-lerna-mono-repo-02
2. mkdir packages
3. cd packages
4. npx create-react-app web-client
5. cd web-client
6. modify package.json to use react 18.0.0
7. npm install --no-audit --save @testing-library/jest-dom@^5.14.1 @testing-library/react@^13.0.0 @testing-library/user-event@^13.2.1 web-vitals@^2.1.0
8. cd ..
9. mkdir server-api
10. cd server-api
11. npm init --yes
12. npm install express body-parser
13. cd ../..
14. npx lerna init
15. npm install  
16. npx lerna clean -y
17. cd packages/server-api
18. add index.js and modify package.json
19. cd ../../web-client
20. modify package.json
21. cd ../..
22. modify package.json
23. npm run start
24. npm i web-vitals --save-dev
