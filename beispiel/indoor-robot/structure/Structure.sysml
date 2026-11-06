// Sample project indoor robot – structure
private import ScalarValues::*;

package Structure {
    attribute def Voltage :> Real;
    attribute def Mass :> Real;

    item def DriveCommand {
        attribute v : Real;      // linear velocity in m/s
        attribute omega : Real;  // turn rate in rad/s
    }
    item def Scan;

    port def PowerPort {
        in attribute u : Voltage;
    }
    port def CommandPort {
        out item cmd : DriveCommand;
    }
    port def ScanPort {
        out item scan : Scan;
    }

    interface def PowerSupply {
        end source : ~PowerPort;
        end sink : PowerPort;
    }

    abstract part def Component {
        attribute mass : Mass;
    }
    part def Battery :> Component {
        attribute capacity : Real = 5.2;
        port output : ~PowerPort;
    }
    part def Controller :> Component {
        doc /* Raspberry Pi 5 running ROS 2 Jazzy */
        perform action navigation : Behaviour::NavigateToGoal;
        port power : PowerPort;
        port scanIn : ~ScanPort;
        port driveOut : CommandPort;
    }
    part def Lidar :> Component {
        port power : PowerPort;
        port scanOut : ScanPort;
    }
    part def Motor :> Component {
        attribute ratedSpeed : Real;
    }
    part def Wheel {
        attribute diameter : Real = 0.065;
    }
    part def Drive {
        port power : PowerPort;
        port driveIn : ~CommandPort;
        part motorLeft : Motor;
        part motorRight : Motor;
        part wheel : Wheel[2];
    }
    part def Robot {
        attribute totalMass : Mass;
        part battery : Battery;
        part controller : Controller;
        part lidar : Lidar;
        part drive : Drive;

        interface : PowerSupply connect battery.output to controller.power;
        interface : PowerSupply connect battery.output to lidar.power;
        interface : PowerSupply connect battery.output to drive.power;
        connect lidar.scanOut to controller.scanIn;
        flow of DriveCommand from controller.driveOut.cmd to drive.driveIn.cmd;

        exhibit state operation : Behaviour::OperatingStates;
    }
}
