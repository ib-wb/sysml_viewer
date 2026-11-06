// Sample project indoor robot – system level: instance, implementation and allocation
package System {
    private import Structure::*;
    private import Requirements::*;

    part robot : Structure::Robot;

    // Which component satisfies which requirement?
    satisfy Requirements::robotRequirements.runtime by robot.battery;
    satisfy Requirements::robotRequirements.obstacle by robot.lidar;
    satisfy Requirements::robotRequirements.scanRate by robot.lidar;
    satisfy Requirements::robotRequirements.weight by robot;

    // Navigation runs on the controller
    allocate Behaviour::NavigateToGoal to robot.controller;
}
