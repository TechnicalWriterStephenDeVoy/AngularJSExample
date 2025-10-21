// Require the necessary modules for the server

const express = require('express');
const multer = require('multer');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const fsPromises = fs.promises;
var path = require('path');
var nodemailer = require('nodemailer');
const app = express();        // Create an instance of the express application

/*
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("req.body=" + JSON.stringify(req.body));
    const { userId } = req.body;
    const dir = "./uploads/" + userId;
    fs.exists(dir, exist => {
      if (!exist) {
        return fs.mkdir(dir, error => cb(error, dir));
      }
      return cb(null, dir);
    })
  }
});
*/

// safely handles circular references
JSON.safeStringify = (obj, indent = 2) => {
  let cache = [];
  const retVal = JSON.stringify(
    obj,
    (key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent
  );
  cache = null;
  return retVal;
};

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        var memberId = req.body.memberId;
    	console.log("file=" + JSON.stringify(file));
    	console.log("req.body=" + JSON.safeStringify(req.body));
    	if ((memberId !== null) && (memberId !== undefined)) {
            cb(null, path.join('./uploads', memberId));
        } else {
            cb(null, './uploads');
        }
     },
    filename: function (req, file, cb) {
        cb(null , file.originalname);
    }
});

// var upload = multer({ storage: storage });
var upload = multer({storage,
                     dest: path.join(__dirname, 'public/img/'), // destination folder
                     limits: {fileSize: 3500000}, // size we will acept, not bigger
                     fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf/; // filetypes you will accept
    const mimetype = filetypes.test(file.mimetype); // verify file is == filetypes you will accept
    const extname = filetypes.test(path.extname(file.originalname)); // extract the file extension
    // if mimetype && extname are true, then no error
    if(mimetype && extname){
        return cb(null, true);
    }
    // if mimetype or extname false, give an error of compatibilty
    return cb("The uploaded file, isn't compatible :( we're sorry");
  }
});


const copysubpath = "uploads/copyfiles";
const memberssubpath = "uploads/members";
const uploadssubpath = "uploads";
const bashsubpath = "../bash";
const distributescript = "distribute.sh";

var fullcopypath = null;
var fulluploadspath = null;
var fullmemberspath = null;
var fullbashpath = null;
var fulldistributescript = null;

var directoryListing = [];

app.use(cors());              // Enable CORS policy for all routes

// Set up the connection to the MySQL database

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',       // Replace with your MySQL username
  password: 'DeathToDonald!',   // Replace with your MySQL password
  database: 'MSIC'    // Replace with your database name
});

 // Establish a connection to the database

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to the MySQL server.'); // Confirmation message
});

// Check data for SQL Injection

const disallowedChars = ",='\"\\";

function containsDisallowedChars(inputStr) {
  if (inputStr == null) return true;
  len = inputStr.length;
  for (i = 0; i < len; i++) {
    if (disallowedChars.indexOf(inputStr[i]) > -1) return true;
  }
  return false;
}

function parseFile(fileName) {
  if (fileName !== null) {
    var index = fileName.lastIndexOf('.');
    var extension = "";
    var name = "";
    var yearMonthDay = null;
    if (index != -1) {
      name = fileName.substring(0, index);
      extension = fileName.substring(index + 1);
      yearMonthDay = name.split('_');
      if (yearMonthDay.length == 1)
      	yearMonthDay = null;
      return {fullName: fileName, name: name, extension: extension, yearMonthDay: yearMonthDay};
    } else {
      return {fullName: fileName, name: fileName, extension: null, yearMonthDay: yearMonthDay};
    }
  } else {
    return {fullName: null, name: null, extension: null, yearMonthDay: null};
  }
}

function mimeTypeFromExtension(extension) {
  if (extension == null) return null;
  var extensionNormalized = extension.toLowerCase();
  switch (extensionNormalized) {
    case "pdf":
    	return "application/pdf";
    case "pps":
    case "pot":
    case "ppt":
    case "ppz":
    	return "application/mspowerpoint";
    case "doc":
    case "dot":
        return "application/msword";
    case "docx":
    	return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "zip":
        return "application/zip";
    case "7z":
        return "application/x-7z-compressed";
    case "gz":
        return "application/x-gzip";
    case "txt":
        return "text/plain";
    case "xls":
        return "application/vnd.ms-excel";
    case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "htm":
    case "html":
        return "text/html";
    case "csv":
    	return "text/csv";
    default:
    	return "text/plain";
  }
}

function containsNonDigits(str) {
    if (str === null) return false;
    
    const len = str.length;
    var i;
    var ch;
    
    for (i = 0; i < len; i++) {
        ch = str.charAt(i);
        if (isNaN(parseInt(ch, 10))) return true;
    }
    
    return false;
}

function sendEmail(toAddress, fromAddress, subject, text) {
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: fromAddress,
      pass: 'NoTeP1desFlores!'
    }
  });
  var mailOptions = {
    from: fromAddress,
    to: toAddress,
    subject: subject,
    text: text
  };
  var response = null;
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      response = error;
      console.log(error);
    } else {
      response = info.response;
      console.log('Email sent: ' + info.response);
    }
  });
  
  return response;
}

function fileNameFromPath(path) {
    if (path === null) return null;
    var indexOfLastSlash = path.lastIndexOf('/');
    if (indexOfLastSlash == -1) return path;
    if (indexOfLastSlash == path.length - 1) return "";
    return path.substring(indexOfLastSlash);
}

app.post('/upload', upload.single('file'), (req, res) => {
  console.log('req.file=' + JSON.stringify(req.file)); // Access uploaded file details
  res.json('File uploaded successfully!');
});

// Define a route to retrieve data from the database

app.get('/data', (req, res) => {
  const query = req.query.query;
  var username = null;
  var memberNumber = null;
  var password = null;
  var fileName = null;
  var parsedFileName = null;
  var authenticated = false;
  var directoryPath = null;
  var extension = null;
  var mimeType = null;
  var sql = null;
  var exludeFilesWithExtensions = false;
  var exludeFilesWithNonDigits = false;
  var name = null;
  
  console.log("*** query type is " + query);
  
  switch (query) {
    case "login":
      username = req.query.username;
      password = req.query.password;
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      connection.query('SELECT call_num, organization, fname, lname, username FROM MSIC.Institutions WHERE username = "'
          + username + '" AND testingpassword = "' + password + '"', (err, results) => {
        if (err) {
          console.log('Error when issuing query to MySQL');
          throw err;
        }
        res.json(results);        // Send query results back to the client
      });
    break;
    case "active_members":
        username = req.query.username;
        password = req.query.password;
    	sql = "CALL MSIC.Members(1, 0)";
    	connection.query(sql, (err, results) => {
	    if (err) {
	        res.json([]);
	    }
	    if (results.length >= 0) {
	        var transformed_results = results[0].map((obj) => String(obj["call_num"]));
	        res.json(transformed_results);        // Send query results back to the client
	    } else {
	        res.json([]);
	    }
          });
    break;
    case "clientDirectory":
      username = req.query.username;
      password = req.query.password;
      authenticated = true;
      directoryListing = [];
      /*
      connection.query('SELECT username FROM MSIC.Institutions WHERE username = "'
          + username + '" AND testingpassword = "' + password + '"', (err, results) => {
        if (err) {
          console.log('Error when issuing query to MySQL');
          throw err;
        }
        authenticated = results.length == 1;        
      });
      */
      if (authenticated) {
      	console.log("username=" + username);
      	directoryPath = path.join(__dirname, 'uploads', 'members', username);
      	console.log(String(directoryPath));
      	
      	fs.readdir(directoryPath, function (err, files) {
	    // handling error
	    if (err) {
		return console.log('Unable to scan directory: ' + err);
	    }
	    
	    // listing all files using forEach
	    files.forEach(function (file) {
	      parsedFile = parseFile(file);
	      if (parsedFile.extension !== null) {
	        directoryListing.push(parsedFile);
	        console.log(file.fullName);
	      }
	      /*
    	      if (file instanceof fs.Dirent) {
    		if (file.isFile()) {
    		  directoryListing.push(file.name);
    		  console.log(file.name); 
    		}
    	      }
    	      */
	    });
	    res.json(directoryListing); 
	});
      } else {
      	throw new Error("Authentication failed.");
      }
    break;
    case "download":
      username = req.query.username;
      password = req.query.password;
      fileName = req.query.filename;
      parsedFileName = parseFile(fileName);
      extension = parsedFileName.extension;
      
      if (extension == null) {
          console.log("Extension is null.");
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404: File not found');
          return;
      }
      
      mimeType = mimeTypeFromExtension(extension);
      directoryPath = path.join(__dirname, 'uploads', 'members', username, fileName);
      console.log("directoryPath='" + directoryPath + "'");
      // fs.readFile(__dirname + req.url, (err, data) => {
      fs.readFile(directoryPath, (err, data) => {
          if (err) {
              console.log("Error serving file.");
              res.writeHead(404, { 'Content-Type': 'text/html' });
              res.end('404: File not found');
          } else {
              console.log("Mime type: " + mimeType);
              res.writeHead(200, { 'Content-Type': mimeType });
	      res.end(data);
          }
      });
    break;
    case "getdir":
      username = req.query.username;
      password = req.query.password;
      directoryType = req.query.type;
      name = req.query.name;
      authenticated = true;
      
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      
      fullcopypath = path.join(__dirname, copysubpath);
      fullmemberspath = path.join(__dirname, memberssubpath);
      fulluploadspath = path.join(__dirname, uploadssubpath);
      fullbashpath = path.join(__dirname, bashsubpath);
      fulldistributescript = path.join(fullbashpath, distributescript);
      
      if (authenticated) {
      	console.log("username=" + username);
      	console.log("directoryType=" + directoryType);
      	console.log("name=" + name);
      	
      	switch (directoryType) {
      	    case "copyfiles":
      	    	directoryPath = fullcopypath;
      	    	exludeFilesWithExtensions = false;
      	    	exludeFilesWithNonDigits = false;
      	    break;
      	    case "memberdir":
      	    	directoryPath = fullmemberspath;
      	    	exludeFilesWithExtensions = true;
      	    	exludeFilesWithNonDigits = false;
      	    break;
      	    case "member":
      	    	directoryPath = path.join(fullmemberspath, name);
      	    	exludeFilesWithExtensions = false;
      	    	exludeFilesWithNonDigits = false;
      	    break;
      	    case "upload":
      	    	directoryPath = fulluploadspath;
      	    	exludeFilesWithExtensions = true;
      	    	exludeFilesWithNonDigits = true;
      	    break;
      	    case "uploadedfiles":
      	    	directoryPath = path.join(fulluploadspath, name);
      	    	exludeFilesWithExtensions = false;
      	    	exludeFilesWithNonDigits = false;
      	    break;
      	    default:
      	    	directoryPath = null;
      	    break;
      	}
      	
      	console.log("directoryPath=" + directoryPath);
      	
      	if (directoryPath !== null) {
      	    fs.readdir(directoryPath, function (err, files) {
	        // handling error
	        if (err) {
		    return console.log('Unable to scan directory: ' + err);
	        }
	        
	        directoryListing = [];
	    
	        // listing all files using forEach
	        files.forEach(function (file) {
	            if (exludeFilesWithExtensions) {
	                if (file.indexOf('.') === -1) {
	                    if (exludeFilesWithNonDigits) {
	                        if (! containsNonDigits(file)) {
	                            directoryListing.push(file);
	                        }
	                    } else {
	    	                directoryListing.push(file);
	      	                // console.log(file);
	      	            }
	      	        }
	      	    } else {
	      	        if (exludeFilesWithNonDigits) {
	      	            if (! containsNonDigits(file)) {
	      	                directoryListing.push(file);
	      	                // console.log(file);
	      	            }
	      	        } else {
	    	            directoryListing.push(file);
	      	            // console.log(file);
	      	        }
	      	    }
	        });
	        res.json(directoryListing);
	    });
	}
	else {
	    throw new Error("Unknown directory type.");
	}
      } else {
      	throw new Error("Authentication failed.");
      }
    break;
    case "makedir":
      username = req.query.username;
      password = req.query.password;
      directoryType = req.query.type;
      name = req.query.name;
      authenticated = true;
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      if (containsNonDigits(name)) throw new Error('Illegal character in directory name');
      switch (directoryType) {
          case "uploadedfiles":
      	      directoryPath = path.join(fulluploadspath, name);
      	      fsPromises.mkdir(directoryPath).then(function() { 
                  console.log('Directory created successfully');
                  res.json("{success: true}");
              }).catch(function() { 
                  console.log('failed to create directory'); 
                  
                  res.json("{success: false}");
              }); 
      	  break;
      	  default:
      	  break;
      }
    break;
    case "assessmentFormDefaults":
      username = req.query.username;
      password = req.query.password;
      if ((username == null) || (username == "")) throw new Error('No username');
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      sql = "CALL MSIC.GetAssessmentFormDefaults(" + username + ");";
      console.log("sql = " + sql);
      connection.query(sql, (err, results) => {
	if (err) {
	  console.log('Error when issuing query to MySQL');
	  throw err;
	}
	console.log(JSON.stringify(results));
	res.json(results);        // Send query results back to the client
      });
    break;
    case "institutionInfo":
      memberNumber = req.query.memberNumber;
      username = req.query.username;
      password = req.query.password;
      
      if ((memberNumber == null) || (memberNumber == "")) throw new Error('No memberNumber');
      if (containsDisallowedChars(memberNumber)) throw new Error('Illegal character in memberNumber');
      
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      
      sql = "CALL MSIC.GetInstitutionInfo(" + memberNumber + ");";
      console.log("sql = " + sql);
      connection.query(sql, (err, results) => {
	if (err) {
	  console.log('Error when issuing query to MySQL');
	  throw err;
	}
	console.log(JSON.stringify(results));
	res.json(results);        // Send query results back to the client
      });
    break;
    case "userinfo":
      username = req.query.username;
      password = req.query.password;
      
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      
      sql = 'SELECT fname, lname, middle FROM MSIC.Institutions WHERE username="' + username + '" AND testingpassword="' + password + '";';
      console.log("sql = " + sql);
      
      connection.query(sql, (err, results) => {
	if (err) {
	  console.log('Error when issuing query to MySQL');
	  throw err;
	}
	console.log(JSON.stringify(results));
	res.json(results);        // Send query results back to the client
      });
      
      break;
    
    default:
      connection.query('SELECT * FROM Institutions', (err, results) => {
        if (err) throw err;
        res.json(results);        // Send query results back to the client
      });
    break;
  }
});

/*
app.post('/data', (req, res) => {
  console.log("req=" + JSON.safeStringify(req));
  const query = req.body.query;
  var username = null;
  var password = null;
  var fileName = null;
  var parsedFileName = null;
  var authenticated = false;
  var directoryPath = null;
  var extension = null;
  var mimeType = null;
  var sql = null;
  var exludeFilesWithExtensions = false;
  var exludeFilesWithNonDigits = false;
  var name = null;
  
  console.log("query type is " + query);
  switch (query) {
    case "upload":
      username = req.body.username;
      password = req.body.password;
      sourcepath = req.body.path;
      directoryType = req.body.type;
      name = req.body.name;
      authenticated = true;
      
      console.log("Upload: username=" + username, ", password=" + password + ", sourcepath=" + sourcepath
        + ", directoryType=" + directoryType + ", name=" + name);
    
      if ((username == null) || (username == "")) throw new Error('No username');
      if (containsDisallowedChars(username)) throw new Error('Illegal character in username');
      if (containsDisallowedChars(password)) throw new Error('Illegal character in password');
      
      fullcopypath = path.join(__dirname, copysubpath);
      fullmemberspath = path.join(__dirname, memberssubpath);
      fulluploadspath = path.join(__dirname, uploadssubpath);
      fullbashpath = path.join(__dirname, bashsubpath);
      fulldistributescript = path.join(fullbashpath, distributescript);
      
      switch (directoryType) {
        case "copyfiles":
      	  directoryPath = fullcopypath;
      	break;
        case "memberdir":
      	  directoryPath = fullmemberspath;
      	break;
        case "member":
      	  directoryPath = path.join(fullmemberspath, name);
      	break;
        case "upload":
      	  directoryPath = fulluploadspath;
      	break;
        case "uploadedfiles":
      	  directoryPath = path.join(fulluploadspath, name);
      	break;
        default:
      	  directoryPath = null;
      	break;
      }
      const upload = multer({ dest: directoryPath });
      const fileName = fileNameFromPath();
      let body = "";
      req.on("data", chunk => {
        body += chunk;
      });
      req.on("end", () => {
        fs.writeFile(path.join(directoryPath, fileName), body, err => {
          if (err) {
            res.statusCode = 500;
            res.end("Error: " + err.message);
          } else {
            res.statusCode = 200;
            res.end("File uploaded");
          }
        });
      });
    break;
  }
})
*/

 

// Start the server on port 3000

const port = 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
