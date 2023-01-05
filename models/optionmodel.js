'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class optionModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
     static getOptions(questionID) {
      return this.findAll({
        where: {
          questionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static getOption(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }

    static addOption({ option, questionID }) {
      return this.create({
        option,
        questionID,
      });
    }

    static updateOption({ option, id }) {
      return this.update(
        {
          option,
        },
        {
          where: {
            id,
          },
        }
      );
    }

    static deleteOption(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static associate(models) {
      // define association here
      optionModel.belongsTo(models.questionsModel, {
        foreignKey: "questionID",
        onDelete: "CASCADE",
      });
    }
  }
  optionModel.init({
    option: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'optionModel',
  });
  return optionModel;
};