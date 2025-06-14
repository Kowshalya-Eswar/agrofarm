

const ValidateRegisterData = (req) =>{
    const {firstName, lastName} = req.body;
    if (!firstName || !lastName) {
        throw new Error("Firstname or Lastname should be present");
    }
}

module.exports = ValidateRegisterData;