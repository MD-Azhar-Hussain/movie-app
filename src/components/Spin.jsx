
import { Button, Spinner } from "flowbite-react";

export function Spin() {
  return (
    <div className="flex flex-row gap-3">
      <Button>
        <Spinner aria-label="Spinner button example" size="sm" light />
        <span className="pl-3">Loading Movies...</span>
      </Button>
      {/* <Button color="alternative">
        <Spinner aria-label="Alternate spinner button example" size="sm" />
        <span className="pl-3">Loading...</span>
      </Button> */}
    </div>
  );
}
export default Spin;