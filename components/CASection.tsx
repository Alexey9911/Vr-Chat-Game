import React from "react";
import ChangeAdressConsole from "./changeAdressConsole/ChangeAdressConsole";

const CASection: React.FC = () => {
  return (
    <div className="instructions">
      <h3 className="font-bold">CA:</h3>
      <ChangeAdressConsole text={""} />
    </div>
  );
};

export default CASection;
